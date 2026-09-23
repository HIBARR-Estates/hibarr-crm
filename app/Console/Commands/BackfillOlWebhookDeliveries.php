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
use Illuminate\Support\Str;

/**
 * One-off, manually-run backfill: pushes pre-existing Deals/Leads into the
 * OL webhook pipeline by emitting real CrmEvents through the same path
 * DealObserver/LeadObserver use (RecordsCrmEvents), tagged with a
 * metadata.origin = 'backfill' marker so they're distinguishable from
 * organic events. Idempotency is checked against ol_webhook_deliveries
 * (not crm_events, which gets pruned by ArchiveCrmEventsJob).
 */
class BackfillOlWebhookDeliveries extends Command
{
    use RecordsCrmEvents;

    protected $signature = 'ol-webhook:backfill
                            {--type=all : deal|lead|all}
                            {--company= : Limit to a single company_id}
                            {--chunk=200 : Chunk size for iteration}
                            {--limit= : Stop after considering this many records per type}
                            {--sleep-ms=0 : Milliseconds to sleep between chunks}
                            {--dry-run : Report what would be synced without emitting events}
                            {--force : Proceed even if OL webhook sync looks disabled}';

    protected $description = 'Backfill pre-existing Deals/Leads into the OL webhook pipeline';

    /** @var array<string, array{model: class-string<Model>, slug: string}> */
    private array $typeMap = [
        'deal' => ['model' => Deal::class, 'slug' => 'deal_created'],
        'lead' => ['model' => Lead::class, 'slug' => 'lead_created'],
    ];

    public function handle(): int
    {
        $force = (bool) $this->option('force');

        if (! $force && ! $this->olWebhookReady()) {
            $this->error('OL webhook sync looks disabled (feature flag "sales.crm-lead-deal-sync", or services.ol_webhook.enabled/endpoint). Enable it first, or pass --force to proceed anyway.');

            return self::FAILURE;
        }

        $type = (string) $this->option('type');
        $types = $type === 'all' ? array_keys($this->typeMap) : [$type];

        foreach ($types as $key) {
            if (! isset($this->typeMap[$key])) {
                $this->error("Unknown --type: {$key}. Expected one of: deal, lead, all.");

                return self::FAILURE;
            }
        }

        $chunkSize = max(1, (int) $this->option('chunk'));
        $limit = $this->option('limit') !== null ? max(0, (int) $this->option('limit')) : null;
        $sleepMs = max(0, (int) $this->option('sleep-ms'));
        $dryRun = (bool) $this->option('dry-run');
        $companyId = $this->option('company') !== null ? (int) $this->option('company') : null;
        $runId = (string) Str::uuid();

        $this->info($dryRun ? '=== DRY RUN: OL webhook backfill ===' : 'Starting OL webhook backfill...');
        $this->line("Run id: {$runId}");

        $summary = [];

        foreach ($types as $key) {
            $summary[] = $this->backfillType($key, $this->typeMap[$key], $companyId, $chunkSize, $limit, $sleepMs, $dryRun, $runId);
        }

        $this->line('');
        $this->table(['Type', 'Candidates', 'Synced', 'Already synced', 'Locked/skipped', 'Errors'], $summary);

        $this->info($dryRun ? '=== DRY RUN COMPLETE ===' : 'OL webhook backfill complete.');

        return self::SUCCESS;
    }

    /**
     * @param  array{model: class-string<Model>, slug: string}  $config
     * @return array<string, int|string>
     */
    private function backfillType(
        string $key,
        array $config,
        ?int $companyId,
        int $chunkSize,
        ?int $limit,
        int $sleepMs,
        bool $dryRun,
        string $runId
    ): array {
        $modelClass = $config['model'];
        $slug = $config['slug'];
        $table = (new $modelClass)->getTable();
        $usesSoftDeletes = in_array(SoftDeletes::class, class_uses_recursive($modelClass), true);

        $baseQuery = fn () => $modelClass::withoutGlobalScopes()
            ->when($companyId, fn (Builder $q) => $q->where('company_id', $companyId))
            ->when($usesSoftDeletes, fn (Builder $q) => $q->whereNull('deleted_at'))
            ->whereNotExists(function ($sub) use ($table, $modelClass, $slug) {
                $sub->select('id')
                    ->from('ol_webhook_deliveries')
                    ->whereColumn('ol_webhook_deliveries.model_id', "{$table}.id")
                    ->where('ol_webhook_deliveries.model_type', $modelClass)
                    ->where('ol_webhook_deliveries.event_type_slug', $slug)
                    ->where('ol_webhook_deliveries.status', OlWebhookDelivery::STATUS_SENT);
            });

        $total = $baseQuery()->count();
        $displayTotal = $limit !== null ? min($total, $limit) : $total;

        $this->line('');
        $this->info(class_basename($modelClass)." ({$displayTotal} candidates, slug: {$slug})");

        $progressBar = $this->output->createProgressBar($displayTotal);
        $progressBar->start();

        $synced = 0;
        $alreadySynced = 0;
        $lockedSkipped = 0;
        $errors = 0;
        $considered = 0;

        $baseQuery()->chunkById($chunkSize, function ($records) use (
            $modelClass,
            $slug,
            $dryRun,
            $runId,
            $limit,
            $progressBar,
            &$synced,
            &$alreadySynced,
            &$lockedSkipped,
            &$errors,
            &$considered
        ) {
            foreach ($records as $record) {
                if ($limit !== null && $considered >= $limit) {
                    return false;
                }
                $considered++;

                $lock = Cache::lock("ol_backfill:{$modelClass}:{$record->getKey()}", 30);

                if (! $lock->get()) {
                    $lockedSkipped++;
                    $progressBar->advance();

                    continue;
                }

                try {
                    $alreadyDelivered = OlWebhookDelivery::forEntity($modelClass, (int) $record->getKey(), $slug)
                        ->where('status', OlWebhookDelivery::STATUS_SENT)
                        ->exists();

                    if ($alreadyDelivered) {
                        $alreadySynced++;

                        continue;
                    }

                    if ($dryRun) {
                        $synced++;

                        continue;
                    }

                    $event = $this->recordCrmEvent($slug, $record, [
                        'metadata' => [
                            'origin' => 'backfill',
                            'backfill_run_id' => $runId,
                        ],
                    ]);

                    if (! $event) {
                        $errors++;
                        Log::warning('OL webhook backfill: recordCrmEvent returned null', [
                            'model' => $modelClass,
                            'id' => $record->getKey(),
                            'slug' => $slug,
                        ]);

                        continue;
                    }

                    $synced++;
                } catch (\Throwable $exception) {
                    $errors++;
                    Log::warning('OL webhook backfill: failed to emit event', [
                        'model' => $modelClass,
                        'id' => $record->getKey(),
                        'slug' => $slug,
                        'error' => $exception->getMessage(),
                    ]);
                } finally {
                    $lock->release();
                    $progressBar->advance();
                }
            }

            return true;
        }, 'id');

        $progressBar->finish();
        $this->line('');

        return [
            'type' => $key,
            'candidates' => $displayTotal,
            'synced' => $synced,
            'already_synced' => $alreadySynced,
            'locked_skipped' => $lockedSkipped,
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
