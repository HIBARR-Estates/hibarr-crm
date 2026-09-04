<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\Lead;
use Closure;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\DB;

/**
 * Measures the wall-clock and query-count difference between the old
 * one-query-per-record custom field read and the new batched read added to
 * CustomFieldsTrait (loadCustomFieldsDataBatch() / primeCustomFieldsDataBatch()).
 *
 * Two modes:
 *  - Synthetic (default): creates a throwaway custom field group, fields, a
 *    lead and N deals inside a transaction that is always rolled back —
 *    nothing persists. Confirms before running outside `local`/`testing`
 *    since it still issues real writes for the duration of the transaction.
 *  - --lead=ID: benchmarks against one real lead and its real deals list —
 *    read-only, no writes — so the numbers reflect actual field counts and
 *    data volume instead of a synthetic shape.
 */
class BenchmarkCustomFieldsBatchRead extends Command
{
    use ConfirmableTrait;

    protected $signature = 'custom-fields:benchmark-batch-read
        {--deals=25 : Number of deals to simulate in the "one lead, many deals" scenario (synthetic mode only)}
        {--fields=10 : Number of custom fields per module to create (synthetic mode only)}
        {--iterations=5 : Repeat each measurement this many times and average, to smooth out noise}
        {--lead= : Benchmark against a real lead ID instead of synthetic data (read-only, no confirmation needed)}
        {--force : Skip the confirmation prompt in non-local environments (synthetic mode only)}';

    protected $description = 'Compare query count and wall-clock time between the old per-record custom field read and the new batched read';

    public function handle(): int
    {
        $iterations = max(1, (int) $this->option('iterations'));
        $leadOption = $this->option('lead');

        if ($leadOption !== null && $leadOption !== '') {
            return $this->benchmarkRealLead((int) $leadOption, $iterations);
        }

        if (!$this->confirmToProceed(
            'This writes benchmark data inside a transaction that is rolled back at the end — safe, but still real writes for the duration.'
        )) {
            return Command::FAILURE;
        }

        return $this->benchmarkSynthetic($iterations);
    }

    private function benchmarkSynthetic(int $iterations): int
    {
        $dealsCount = max(1, (int) $this->option('deals'));
        $fieldsCount = max(1, (int) $this->option('fields'));

        // DealObserver::creating() only fills company_id from company(),
        // which needs an authenticated user — never true in a console
        // command — and DealObserver::created() then fails inserting the
        // 'deal_created' crm_events row (company_id is NOT NULL) if it's
        // left unset. Resolve a real company explicitly instead of relying
        // on request context that doesn't exist here.
        $companyId = Company::query()->value('id');

        if (!$companyId) {
            $this->error('No company found to attach synthetic deals to — cannot run the synthetic benchmark. Try --lead=ID against real data instead.');

            return Command::FAILURE;
        }

        $this->info("Synthetic benchmark — {$dealsCount} deals, {$fieldsCount} custom fields per module, {$iterations} iteration(s).");
        $this->comment('Everything below runs inside a transaction that is rolled back at the end — nothing persists.');

        DB::beginTransaction();

        try {
            $dealGroup = CustomFieldGroup::firstOrCreate(['model' => Deal::CUSTOM_FIELD_MODEL], ['name' => 'Deal']);
            $leadGroup = CustomFieldGroup::firstOrCreate(['model' => Lead::CUSTOM_FIELD_MODEL], ['name' => 'Lead']);

            $dealFields = collect(range(1, $fieldsCount))->map(fn ($i) => CustomField::create([
                'custom_field_group_id' => $dealGroup->id,
                'label' => "Bench deal field {$i}",
                'name' => "bench_deal_field_{$i}_".uniqid(),
                'type' => 'text',
                'required' => 'no',
                'export' => 0,
            ]));

            $leadFields = collect(range(1, $fieldsCount))->map(fn ($i) => CustomField::create([
                'custom_field_group_id' => $leadGroup->id,
                'label' => "Bench lead field {$i}",
                'name' => "bench_lead_field_{$i}_".uniqid(),
                'type' => 'text',
                'required' => 'no',
                'export' => 0,
            ]));

            // Never persisted to `leads` — the batched loader never joins
            // that table, so a bare instance with a stable id is enough.
            $leadId = 900000001;

            foreach ($leadFields as $field) {
                DB::table('custom_fields_data')->insert([
                    'model' => Lead::CUSTOM_FIELD_MODEL,
                    'model_id' => $leadId,
                    'custom_field_id' => $field->id,
                    'value' => 'bench-value',
                ]);
            }

            $this->comment("Seeding {$dealsCount} deals with {$fieldsCount} field values each…");
            $dealIds = [];

            foreach (range(1, $dealsCount) as $i) {
                $deal = Deal::factory()->create(['company_id' => $companyId]);
                $dealIds[] = $deal->id;

                foreach ($dealFields as $field) {
                    DB::table('custom_fields_data')->insert([
                        'model' => Deal::CUSTOM_FIELD_MODEL,
                        'model_id' => $deal->id,
                        'custom_field_id' => $field->id,
                        'value' => 'bench-value',
                    ]);
                }
            }

            $this->benchmarkPair($dealIds[0], $leadId, $iterations);
            $this->benchmarkManyDeals($dealIds, $iterations);
        } finally {
            DB::rollBack();
        }

        return Command::SUCCESS;
    }

    private function benchmarkRealLead(int $leadId, int $iterations): int
    {
        $lead = Lead::find($leadId);

        if (!$lead) {
            $this->error("Lead {$leadId} not found.");

            return Command::FAILURE;
        }

        $dealIds = Deal::where('lead_id', $leadId)->pluck('id')->all();

        if (empty($dealIds)) {
            $this->error("Lead {$leadId} has no deals to benchmark against.");

            return Command::FAILURE;
        }

        $this->info(sprintf(
            'Real-data benchmark — lead #%d, %d deal(s), %d iteration(s). Read-only, nothing is written.',
            $leadId,
            count($dealIds),
            $iterations
        ));

        $this->benchmarkPair($dealIds[0], $leadId, $iterations);
        $this->benchmarkManyDeals($dealIds, $iterations);

        return Command::SUCCESS;
    }

    /** Scenario 1: one deal + its lead — DealController@show's shape. */
    private function benchmarkPair(int $dealId, int $leadId, int $iterations): void
    {
        $this->newLine();
        $this->line('<fg=cyan>Scenario 1 — one deal + its lead (DealController@show)</>');

        $old = $this->timeAndCount($iterations, function () use ($dealId, $leadId) {
            $deal = Deal::find($dealId);
            $lead = $this->bareLead($leadId);

            $deal->getCustomFieldsData();
            $lead->getCustomFieldsData();
        });

        $new = $this->timeAndCount($iterations, function () use ($dealId, $leadId) {
            $deal = Deal::find($dealId);
            $lead = $this->bareLead($leadId);

            Deal::primeCustomFieldsDataBatch([$deal, $lead]);
            $deal->getCustomFieldsData();
            $lead->getCustomFieldsData();
        });

        $this->report($old, $new);
    }

    /** Scenario 2: one lead's whole deal list — LeadContactController's map(). */
    private function benchmarkManyDeals(array $dealIds, int $iterations): void
    {
        $this->newLine();
        $this->line('<fg=cyan>Scenario 2 — one lead\'s '.count($dealIds).' deal(s) (LeadContactController)</>');

        $old = $this->timeAndCount($iterations, function () use ($dealIds) {
            $deals = Deal::whereIn('id', $dealIds)->get();

            foreach ($deals as $deal) {
                $deal->getCustomFieldsData();
            }
        });

        $new = $this->timeAndCount($iterations, function () use ($dealIds) {
            $deals = Deal::whereIn('id', $dealIds)->get();
            Deal::primeCustomFieldsDataBatch($deals->all());

            foreach ($deals as $deal) {
                $deal->getCustomFieldsData();
            }
        });

        $this->report($old, $new);
    }

    /** A Lead instance that never touches the `leads` table — see class docblock. */
    private function bareLead(int $leadId): Lead
    {
        $lead = new Lead();
        $lead->id = $leadId;
        $lead->exists = true;

        return $lead;
    }

    /**
     * @return array{ms: float, queries: int}
     */
    private function timeAndCount(int $iterations, Closure $callback): array
    {
        $totalMs = 0.0;
        $totalQueries = 0;

        for ($i = 0; $i < $iterations; $i++) {
            DB::flushQueryLog();
            DB::enableQueryLog();

            $start = microtime(true);
            $callback();
            $totalMs += (microtime(true) - $start) * 1000;

            $totalQueries += count(DB::getQueryLog());
            DB::disableQueryLog();
        }

        return [
            'ms' => $totalMs / $iterations,
            'queries' => (int) round($totalQueries / $iterations),
        ];
    }

    /**
     * @param  array{ms: float, queries: int}  $old
     * @param  array{ms: float, queries: int}  $new
     */
    private function report(array $old, array $new): void
    {
        $msDelta = $old['ms'] - $new['ms'];
        $speedup = $new['ms'] > 0 ? $old['ms'] / $new['ms'] : INF;
        $queryDelta = $old['queries'] - $new['queries'];

        $this->table(
            ['', 'Queries', 'Avg time'],
            [
                ['Old (per-record reads)', $old['queries'], number_format($old['ms'], 3).' ms'],
                ['New (batched read)', $new['queries'], number_format($new['ms'], 3).' ms'],
            ]
        );

        $this->info(sprintf(
            '-> %d fewer %s, %.3f ms faster on average (%.1fx).',
            $queryDelta,
            $queryDelta === 1 ? 'query' : 'queries',
            $msDelta,
            $speedup
        ));
    }
}
