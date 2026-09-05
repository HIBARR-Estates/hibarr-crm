<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use Closure;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\DB;

/**
 * Measures the wall-clock and query-count difference between the
 * pre-optimization write loop and the current one in
 * CustomFieldsTrait::updateCustomFieldData() (the "query storm inside a
 * single write" — hoisted CustomField lookup, snapshot-based insert-vs-update
 * decision, reused field map for history entries).
 *
 * The old code is gone from the trait, so both sides are reconstructed here
 * rather than diffed against git history — legacyWriteLoop() is a faithful
 * copy of the pre-optimization shape, optimizedWriteLoop() mirrors the
 * current trait code. Both deliberately stop short of dispatching
 * DealActivityEventService / DealAutomationService: those are unmodified by
 * this change and identical on both sides, so including them would only add
 * equal, unrelated noise to both numbers instead of isolating what changed.
 *
 * Both legacyWriteLoop() and optimizedWriteLoop() call the real (current)
 * Deal::getCustomFieldsData() for their before/after snapshots — that method
 * is Part A's batched read, a separate, already-shared optimization this
 * benchmark isn't re-measuring (see custom-fields:benchmark-batch-read for
 * that one). Isolating it this way means the difference reported here is
 * exactly Part C's write-loop change, not a mix of both.
 *
 * Synthetic only — creates a throwaway custom field group, fields, and a
 * deal inside a transaction that is always rolled back. Confirms before
 * running outside local/testing.
 */
class BenchmarkCustomFieldsWrite extends Command
{
    use ConfirmableTrait;

    protected $signature = 'custom-fields:benchmark-write
        {--fields=20 : Number of fields to write in one call}
        {--iterations=5 : Repeat each measurement this many times and average, to smooth out noise}
        {--force : Skip the confirmation prompt in non-local environments}';

    protected $description = 'Compare query count and wall-clock time between the old per-field write loop and the current batched one';

    public function handle(): int
    {
        if (!$this->confirmToProceed(
            'This writes benchmark data inside a transaction that is rolled back at the end — safe, but still real writes for the duration.'
        )) {
            return Command::FAILURE;
        }

        $fieldsCount = max(1, (int) $this->option('fields'));
        $iterations = max(1, (int) $this->option('iterations'));

        $companyId = Company::query()->value('id');

        if (!$companyId) {
            $this->error('No company found to attach the synthetic deal to.');

            return Command::FAILURE;
        }

        $this->info("Write benchmark — {$fieldsCount} fields per call, {$iterations} iteration(s).");
        $this->comment('Everything below runs inside a transaction that is rolled back at the end — nothing persists.');
        $this->comment('Both sides exclude automation/CRM-event dispatch (unmodified, identical either way) to isolate just the write-loop change.');

        DB::beginTransaction();

        try {
            $group = CustomFieldGroup::firstOrCreate(['model' => Deal::CUSTOM_FIELD_MODEL], ['name' => 'Deal']);

            $fields = collect(range(1, $fieldsCount))->map(fn ($i) => CustomField::create([
                'custom_field_group_id' => $group->id,
                'label' => "Bench field {$i}",
                'name' => "bench_field_{$i}_".uniqid(),
                'type' => 'text',
                'required' => 'no',
                'export' => 0,
            ]));

            $this->benchmarkAllInserts($companyId, $fields, $iterations);
            $this->benchmarkAllUpdates($companyId, $fields, $iterations);
        } finally {
            DB::rollBack();
        }

        return Command::SUCCESS;
    }

    /** Scenario 1: every field is new — no existing custom_fields_data row for any of them. */
    private function benchmarkAllInserts(int $companyId, \Illuminate\Support\Collection $fields, int $iterations): void
    {
        $this->newLine();
        $this->line('<fg=cyan>Scenario 1 — '.$fields->count().' new fields (all inserts)</>');

        $old = $this->timeAndCount($iterations, function () use ($companyId, $fields) {
            $deal = Deal::factory()->create(['company_id' => $companyId]);
            $this->legacyWriteLoop($deal, $this->payloadFor($fields));
        });

        $new = $this->timeAndCount($iterations, function () use ($companyId, $fields) {
            $deal = Deal::factory()->create(['company_id' => $companyId]);
            $this->optimizedWriteLoop($deal, $this->payloadFor($fields));
        });

        $this->report($old, $new);
    }

    /** Scenario 2: every field already has a row — all updates, the case the snapshot-reuse targets. */
    private function benchmarkAllUpdates(int $companyId, \Illuminate\Support\Collection $fields, int $iterations): void
    {
        $this->newLine();
        $this->line('<fg=cyan>Scenario 2 — '.$fields->count().' existing fields (all updates)</>');

        $old = $this->timeAndCount($iterations, function () use ($companyId, $fields) {
            $deal = Deal::factory()->create(['company_id' => $companyId]);
            $this->seedExistingValues($deal, $fields);
            $this->legacyWriteLoop($deal, $this->payloadFor($fields));
        });

        $new = $this->timeAndCount($iterations, function () use ($companyId, $fields) {
            $deal = Deal::factory()->create(['company_id' => $companyId]);
            $this->seedExistingValues($deal, $fields);
            $this->optimizedWriteLoop($deal, $this->payloadFor($fields));
        });

        $this->report($old, $new);
    }

    private function payloadFor(\Illuminate\Support\Collection $fields): array
    {
        return $fields->mapWithKeys(fn ($f) => ['field_'.$f->id => 'bench-value-'.uniqid()])->all();
    }

    private function seedExistingValues(Deal $deal, \Illuminate\Support\Collection $fields): void
    {
        foreach ($fields as $field) {
            DB::table('custom_fields_data')->insert([
                'model' => Deal::CUSTOM_FIELD_MODEL,
                'model_id' => $deal->id,
                'custom_field_id' => $field->id,
                'value' => 'seed-value',
            ]);
        }
        $deal->forgetCustomFieldValuesMemo();
    }

    /**
     * Pre-Part-C shape: a CustomField::findOrFail() and a SELECT per field,
     * then an insert or update decided from that SELECT, then a per-changed-
     * field CustomField::find() while building history entries.
     */
    private function legacyWriteLoop(Deal $deal, array $fields): void
    {
        $beforeSnapshot = $deal->getCustomFieldsData()->toArray();
        $requestedFieldKeys = array_keys($fields);

        foreach ($fields as $key => $value) {
            $id = (int) substr($key, 6);
            CustomField::findOrFail($id); // per-field lookup

            $existingEntry = DB::table('custom_fields_data')
                ->where('model', Deal::CUSTOM_FIELD_MODEL)
                ->where('model_id', $deal->id)
                ->where('custom_field_id', $id)
                ->first(); // per-field existence check

            if ($existingEntry) {
                DB::table('custom_fields_data')
                    ->where('model', Deal::CUSTOM_FIELD_MODEL)
                    ->where('model_id', $deal->id)
                    ->where('custom_field_id', $id)
                    ->update(['value' => $value]);
            } else {
                DB::table('custom_fields_data')->insert([
                    'model' => Deal::CUSTOM_FIELD_MODEL,
                    'model_id' => $deal->id,
                    'custom_field_id' => $id,
                    'value' => $value,
                ]);
            }
        }

        $deal->forgetCustomFieldValuesMemo();
        $afterSnapshot = $deal->getCustomFieldsData()->toArray();

        foreach ($requestedFieldKeys as $fieldKey) {
            $oldVal = $beforeSnapshot[$fieldKey] ?? null;
            $newVal = $afterSnapshot[$fieldKey] ?? null;
            if ((string) $oldVal === (string) $newVal) {
                continue;
            }
            $fieldId = (int) substr($fieldKey, 6);
            CustomField::find($fieldId); // per-changed-field re-fetch for history
        }
    }

    /** Current shape: hoisted whereIn, snapshot-based insert-vs-update, reused map for history. */
    private function optimizedWriteLoop(Deal $deal, array $fields): void
    {
        $beforeSnapshot = $deal->getCustomFieldsData()->toArray();
        $requestedFieldKeys = array_keys($fields);

        $fieldIds = array_map(fn ($key) => (int) substr($key, 6), $requestedFieldKeys);
        $customFieldsById = CustomField::whereIn('id', $fieldIds)->get()->keyBy('id');

        foreach ($fields as $key => $value) {
            $id = (int) substr($key, 6);
            $customFieldsById->get($id); // in-memory, no query

            $fieldKey = 'field_'.$id;
            $hasExistingRow = ($beforeSnapshot[$fieldKey] ?? null) !== null;

            if ($hasExistingRow) {
                DB::table('custom_fields_data')
                    ->where('model', Deal::CUSTOM_FIELD_MODEL)
                    ->where('model_id', $deal->id)
                    ->where('custom_field_id', $id)
                    ->update(['value' => $value]);
            } else {
                DB::table('custom_fields_data')->insert([
                    'model' => Deal::CUSTOM_FIELD_MODEL,
                    'model_id' => $deal->id,
                    'custom_field_id' => $id,
                    'value' => $value,
                ]);
            }
        }

        $deal->forgetCustomFieldValuesMemo();
        $deal->getCustomFieldsData()->toArray(); // after-snapshot — history built from $customFieldsById, no extra queries
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
                ['Old (per-field loop)', $old['queries'], number_format($old['ms'], 3).' ms'],
                ['New (batched loop)', $new['queries'], number_format($new['ms'], 3).' ms'],
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
