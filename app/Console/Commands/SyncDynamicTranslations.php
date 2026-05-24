<?php

namespace App\Console\Commands;

use App\Models\Deal;
use App\Models\Lead;
use App\Services\DynamicTranslationService;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class SyncDynamicTranslations extends Command
{
    protected $signature = 'translations:sync-dynamic
                            {--model=* : Model class names or aliases (Deal, Lead)}
                            {--all : Process all registered models}
                            {--columns=* : Override translatable columns for all selected models}
                            {--chunk=50 : Chunk size for model iteration}
                            {--dry-run : Show what would be queued without dispatching jobs}';

    protected $description = 'Backfill dynamic translations from model text columns';

    /**
     * @var array<string, class-string<Model>>
     */
    private array $modelAliasMap = [
        'deal' => Deal::class,
        'lead' => Lead::class,
    ];

    public function handle(DynamicTranslationService $translationService): int
    {
        $modelClasses = $this->resolveModelClasses();

        if (empty($modelClasses)) {
            $this->error('No valid models resolved. Use --all or --model=Deal --model=Lead.');
            return self::FAILURE;
        }

        $chunkSize = max(1, (int) $this->option('chunk'));
        $dryRun = (bool) $this->option('dry-run');
        $overrideColumns = $this->sanitizeColumns($this->option('columns'));

        $this->info($dryRun ? '=== DRY RUN: Dynamic translation sync ===' : 'Starting dynamic translation sync...');

        $summary = [];

        foreach ($modelClasses as $modelClass) {
            /** @var Model $model */
            $model = new $modelClass();

            $table = $model->getTable();
            $keyName = $model->getKeyName();

            $columns = empty($overrideColumns)
                ? $this->getModelTranslatableColumns($model)
                : $overrideColumns;

            $columns = $this->filterExistingColumns($table, $columns);

            if (empty($columns)) {
                $this->warn("Skipping {$modelClass}: no translatable columns resolved.");
                $summary[] = [
                    'model' => class_basename($modelClass),
                    'records' => 0,
                    'texts' => 0,
                    'queued' => 0,
                    'errors' => 0,
                ];
                continue;
            }

            $query = $modelClass::query()->select(array_merge([$keyName], $columns));
            $totalRecords = (clone $query)->count();

            $this->line('');
            $this->info("Processing {$modelClass} ({$totalRecords} records) with columns: " . implode(', ', $columns));

            $progressBar = $this->output->createProgressBar($totalRecords);
            $progressBar->start();

            $recordCount = 0;
            $textCount = 0;
            $queuedCount = 0;
            $errorCount = 0;
            $seenHashes = [];

            $query->chunkById($chunkSize, function ($rows) use (
                $columns,
                $keyName,
                $dryRun,
                $modelClass,
                $translationService,
                &$recordCount,
                &$textCount,
                &$queuedCount,
                &$errorCount,
                &$seenHashes,
                $progressBar
            ) {
                foreach ($rows as $row) {
                    $recordCount++;

                    foreach ($columns as $column) {
                        $value = $row->getAttribute($column);

                        if (!is_string($value) || trim($value) === '') {
                            continue;
                        }

                        $textCount++;

                        try {
                            $hash = $translationService->hash($value);

                            if (isset($seenHashes[$hash])) {
                                continue;
                            }

                            $seenHashes[$hash] = true;

                            if (!$dryRun) {
                                $translationService->ensureExists($value);
                            }

                            $queuedCount++;
                        } catch (\Throwable $exception) {
                            $errorCount++;

                            Log::warning('SyncDynamicTranslations: Failed processing record field', [
                                'model' => $modelClass,
                                'id' => $row->getAttribute($keyName),
                                'column' => $column,
                                'error' => $exception->getMessage(),
                            ]);
                        }
                    }

                    $progressBar->advance();
                }
            }, $keyName);

            $progressBar->finish();
            $this->line('');

            $summary[] = [
                'model' => class_basename($modelClass),
                'records' => $recordCount,
                'texts' => $textCount,
                'queued' => $queuedCount,
                'errors' => $errorCount,
            ];
        }

        $this->line('');
        $this->table(['Model', 'Records', 'Text values', 'Queued/Ensured', 'Errors'], $summary);

        if ($dryRun) {
            $this->info('=== DRY RUN COMPLETE ===');
        } else {
            $this->info('Dynamic translation sync complete.');
        }

        return self::SUCCESS;
    }

    /**
     * @return array<int, class-string<Model>>
     */
    private function resolveModelClasses(): array
    {
        $all = (bool) $this->option('all');
        $modelOptions = (array) $this->option('model');

        if ($all) {
            return array_values(array_unique(array_values($this->modelAliasMap)));
        }

        if (empty($modelOptions)) {
            return [];
        }

        $resolved = [];

        foreach ($modelOptions as $modelOption) {
            if (!is_string($modelOption) || trim($modelOption) === '') {
                continue;
            }

            $candidate = trim($modelOption);
            $alias = strtolower($candidate);

            if (isset($this->modelAliasMap[$alias])) {
                $resolved[] = $this->modelAliasMap[$alias];
                continue;
            }

            if (!str_contains($candidate, '\\')) {
                $candidate = 'App\\Models\\' . $candidate;
            }

            if (!class_exists($candidate) || !is_subclass_of($candidate, Model::class)) {
                $this->warn("Ignoring invalid model option: {$modelOption}");
                continue;
            }

            $resolved[] = $candidate;
        }

        return array_values(array_unique($resolved));
    }

    /**
     * @param array<int, mixed> $rawColumns
     * @return array<int, string>
     */
    private function sanitizeColumns(array $rawColumns): array
    {
        return array_values(array_unique(array_filter(
            array_map(
                static fn ($column): string => is_string($column) ? trim($column) : '',
                $rawColumns
            ),
            static fn (string $column): bool => $column !== ''
        )));
    }

    /**
     * @return array<int, string>
     */
    private function getModelTranslatableColumns(Model $model): array
    {
        if (!property_exists($model, 'translatableFields')) {
            return [];
        }

        $fields = $model->translatableFields;

        if (!is_array($fields)) {
            return [];
        }

        return $this->sanitizeColumns($fields);
    }

    /**
     * @param array<int, string> $columns
     * @return array<int, string>
     */
    private function filterExistingColumns(string $table, array $columns): array
    {
        return array_values(array_filter($columns, static fn (string $column): bool => Schema::hasColumn($table, $column)));
    }
}
