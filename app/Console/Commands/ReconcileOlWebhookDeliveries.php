<?php

namespace App\Console\Commands;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\OlWebhookDelivery;
use App\Support\FeatureFlags;
use App\Traits\RecordsCrmEvents;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Scheduled self-heal for the CRM -> OL webhook pipeline. Finds Deals/Leads
 * whose `*_created` event was never delivered (`sent`) — rejected, exhausted,
 * or never emitted — and re-emits it through the same RecordsCrmEvents path
 * BackfillOlWebhookDeliveries uses. Unlike that one-off command it leaves
 * alone anything with a delivery still in flight (pending/failed inside the
 * grace window, i.e. the queue's own retries are handling it) and gives up
 * after --max-attempts reconcile attempts per record so a permanently
 * rejected payload doesn't get re-emitted forever.
 */
class ReconcileOlWebhookDeliveries extends Command
{
    use RecordsCrmEvents;

    protected $signature = 'ol-webhook:reconcile
                            {--type=all : deal|lead|all}
                            {--grace=30 : Minutes a pending/failed delivery is left to the queue\'s own retries}
                            {--max-attempts=3 : Reconcile attempts per record before giving up}
                            {--limit=200 : Max records re-emitted per type per run}
                            {--dry-run : Report what would be re-emitted without emitting events}';

    protected $description = 'Re-emit Deal/Lead created events that never reached OL (rejected, exhausted or missing deliveries)';

    /** @var array<string, array{model: class-string<Model>, slug: string}> */
    private array $typeMap = [
        'deal' => ['model' => Deal::class, 'slug' => 'deal_created'],
        'lead' => ['model' => Lead::class, 'slug' => 'lead_created'],
    ];

    public function handle(): int
    {
        if (! $this->olWebhookReady()) {
            $this->line('OL webhook sync is disabled; nothing to reconcile.');

            return self::SUCCESS;
        }

        $type = (string) $this->option('type');
        $types = $type === 'all' ? array_keys($this->typeMap) : [$type];

        foreach ($types as $key) {
            if (! isset($this->typeMap[$key])) {
                $this->error("Unknown --type: {$key}. Expected one of: deal, lead, all.");

                return self::FAILURE;
            }
        }

        $grace = max(1, (int) $this->option('grace'));
        $maxAttempts = max(1, (int) $this->option('max-attempts'));
        $limit = max(1, (int) $this->option('limit'));
        $dryRun = (bool) $this->option('dry-run');

        $rows = [];
        foreach ($types as $key) {
            $rows[] = $this->reconcileType($key, $this->typeMap[$key], $grace, $maxAttempts, $limit, $dryRun);
        }

        $this->table(['Type', 'Candidates', 'Re-emitted', 'Gave up', 'Errors'], $rows);

        return self::SUCCESS;
    }

    /**
     * @param  array{model: class-string<Model>, slug: string}  $config
     * @return array<string, int|string>
     */
    private function reconcileType(string $key, array $config, int $grace, int $maxAttempts, int $limit, bool $dryRun): array
    {
        $modelClass = $config['model'];
        $slug = $config['slug'];
        $table = (new $modelClass)->getTable();
        $usesSoftDeletes = in_array(SoftDeletes::class, class_uses_recursive($modelClass), true);
        $inFlightSince = now()->subMinutes($grace);

        $forEntity = fn ($sub) => $sub->select('id')
            ->from('ol_webhook_deliveries')
            ->whereColumn('ol_webhook_deliveries.model_id', "{$table}.id")
            ->where('ol_webhook_deliveries.model_type', $modelClass)
            ->where('ol_webhook_deliveries.event_type_slug', $slug);

        $candidates = $modelClass::withoutGlobalScopes()
            ->when($usesSoftDeletes, fn (Builder $q) => $q->whereNull('deleted_at'))
            // Records younger than the grace window still have their first delivery in flight.
            ->where("{$table}.created_at", '<', $inFlightSince)
            ->whereNotExists(fn ($sub) => $forEntity($sub)->where('ol_webhook_deliveries.status', OlWebhookDelivery::STATUS_SENT))
            ->whereNotExists(fn ($sub) => $forEntity($sub)
                ->whereIn('ol_webhook_deliveries.status', [OlWebhookDelivery::STATUS_PENDING, OlWebhookDelivery::STATUS_FAILED])
                ->where('ol_webhook_deliveries.updated_at', '>=', $inFlightSince));

        $total = (clone $candidates)->count();
        $reEmitted = 0;
        $gaveUp = 0;
        $errors = 0;

        foreach ($candidates->orderBy("{$table}.id")->limit($limit)->get() as $record) {
            $attempts = OlWebhookDelivery::forEntity($modelClass, (int) $record->getKey(), $slug)
                ->where('origin', OlWebhookDelivery::ORIGIN_RECONCILE)
                ->count();

            if ($attempts >= $maxAttempts) {
                $gaveUp++;
                // Stable message so log alerting can match records that need a human.
                Log::error('OL webhook reconcile: giving up on record', [
                    'model' => $modelClass,
                    'id' => $record->getKey(),
                    'slug' => $slug,
                    'reconcile_attempts' => $attempts,
                ]);

                continue;
            }

            if ($dryRun) {
                $this->line("Would re-emit {$slug} for {$modelClass}#{$record->getKey()}");
                $reEmitted++;

                continue;
            }

            $lock = Cache::lock("ol_reconcile:{$modelClass}:{$record->getKey()}", 30);
            if (! $lock->get()) {
                continue;
            }

            try {
                $event = $this->recordCrmEvent($slug, $record, [
                    'metadata' => ['origin' => OlWebhookDelivery::ORIGIN_RECONCILE],
                ]);

                $event ? $reEmitted++ : $errors++;
            } catch (\Throwable $exception) {
                $errors++;
                Log::warning('OL webhook reconcile: failed to emit event', [
                    'model' => $modelClass,
                    'id' => $record->getKey(),
                    'slug' => $slug,
                    'error' => $exception->getMessage(),
                ]);
            } finally {
                $lock->release();
            }
        }

        return [
            'type' => $key,
            'candidates' => $total,
            're_emitted' => $reEmitted,
            'gave_up' => $gaveUp,
            'errors' => $errors,
        ];
    }

    private function olWebhookReady(): bool
    {
        return FeatureFlags::enabled('sales.crm-lead-deal-sync')
            && (bool) config('services.ol_webhook.enabled', false)
            && (string) config('services.ol_webhook.endpoint', '') !== '';
    }
}
