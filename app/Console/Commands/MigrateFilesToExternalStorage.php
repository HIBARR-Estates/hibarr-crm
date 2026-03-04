<?php

namespace App\Console\Commands;

use App\Jobs\MigrateFileJob;
use App\Services\FileMigration\FileMigrationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Bus;

/**
 * Artisan command to migrate local files to external storage.
 *
 * Usage:
 *   php artisan files:migrate-external                        # Migrate all model types
 *   php artisan files:migrate-external --model=deal_files     # Only deal files
 *   php artisan files:migrate-external --dry-run              # Preview without uploading
 *   php artisan files:migrate-external --limit=50             # Process at most 50 records
 *   php artisan files:migrate-external --chunk=25             # 25 jobs per batch chunk
 */
class MigrateFilesToExternalStorage extends Command
{
    protected $signature = 'files:migrate-external
        {--model= : Specific migrator to run (deal_files, custom_field_files, hibarr_deal_documents)}
        {--limit=0 : Maximum records to process per migrator (0 = all)}
        {--dry-run : Preview what would be migrated without actually uploading}
        {--chunk=100 : Number of jobs per batch chunk}';

    protected $description = 'Migrate existing local files to external storage (FileUploadService API)';

    public function handle(): int
    {
        $service = FileMigrationService::withDefaultMigrators();
        $modelFilter = $this->option('model');
        $limit = (int) $this->option('limit');
        $dryRun = (bool) $this->option('dry-run');
        $chunkSize = (int) $this->option('chunk');

        // Validate --model if provided
        if ($modelFilter) {
            $available = $service->getAvailableNames();
            if (!in_array($modelFilter, $available, true)) {
                $this->error("Unknown model '{$modelFilter}'. Available: " . implode(', ', $available));
                return self::FAILURE;
            }
        }

        $this->info('');
        $this->info($dryRun ? '🔍 DRY RUN — no files will be uploaded' : '🚀 Starting file migration to external storage');
        $this->info('');

        // Display unmigrated counts
        $counts = $service->countUnmigrated($modelFilter);
        $this->displayCounts($service, $counts);

        $totalDispatched = 0;
        $batchIds = [];

        $migratorNames = $modelFilter ? [$modelFilter] : $service->getAvailableNames();

        foreach ($migratorNames as $name) {
            $count = $counts[$name] ?? 0;

            if ($count <= 0) {
                $this->line("  ⏭  {$name}: nothing to migrate");
                continue;
            }

            if ($dryRun) {
                $this->displayDryRun($service, $name);
                continue;
            }

            // Dispatch jobs
            $this->line('');
            $this->info("  📦 Dispatching jobs for: {$name}");

            $ids = $service->getUnmigratedIds($name, $limit);
            $recordCount = count($ids);

            if ($recordCount === 0) {
                $this->line("     No records found.");
                continue;
            }

            $this->line("     Records to process: {$recordCount}");

            // Build jobs
            $jobs = collect($ids)->map(
                fn(int $id) => new MigrateFileJob($name, $id)
            );

            // Dispatch in chunks as a Bus::batch
            $chunks = $jobs->chunk($chunkSize);
            $chunkIndex = 0;

            foreach ($chunks as $chunk) {
                $chunkIndex++;
                $batchName = "file-migration:{$name}:chunk-{$chunkIndex}";

                $batch = Bus::batch($chunk->all())
                    ->name($batchName)
                    ->allowFailures()
                    ->dispatch();

                $batchIds[] = [
                    'migrator' => $name,
                    'batch_id' => $batch->id,
                    'jobs'     => $chunk->count(),
                ];

                $totalDispatched += $chunk->count();

                $this->line("     Batch dispatched: {$batchName} ({$chunk->count()} jobs) — ID: {$batch->id}");
            }
        }

        // Summary
        $this->line('');
        $this->info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if ($dryRun) {
            $this->info('  Dry run complete. No changes were made.');
        } else {
            $this->info("  Total jobs dispatched: {$totalDispatched}");

            if (!empty($batchIds)) {
                $this->line('');
                $this->table(
                    ['Migrator', 'Batch ID', 'Jobs'],
                    array_map(fn($b) => [$b['migrator'], $b['batch_id'], $b['jobs']], $batchIds)
                );
                $this->line('');
                $this->info('  Monitor progress: php artisan queue:work');
                $this->info('  Check batches:    SELECT * FROM job_batches ORDER BY created_at DESC;');
            }
        }

        $this->info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        $this->line('');

        return self::SUCCESS;
    }

    /**
     * Display a table of unmigrated record counts.
     */
    protected function displayCounts(FileMigrationService $service, array $counts): void
    {
        $rows = [];
        foreach ($counts as $name => $count) {
            $migrator = $service->getMigrator($name);
            $rows[] = [
                $name,
                $migrator->getDescription(),
                $count >= 0 ? $count : 'ERROR',
            ];
        }

        $this->table(['Migrator', 'Description', 'Unmigrated'], $rows);
    }

    /**
     * Display a dry-run preview for a migrator.
     */
    protected function displayDryRun(FileMigrationService $service, string $name): void
    {
        $migrator = $service->getMigrator($name);
        $samples = $service->getSample($name, 5);

        $this->line('');
        $this->info("  📋 {$name} — Sample records:");

        if (empty($samples)) {
            $this->line('     (no records)');
            return;
        }

        // Get column headers from the first sample
        $headers = array_keys($samples[0]);
        $rows = array_map(function ($sample) {
            return array_map(function ($val) {
                $str = (string) ($val ?? 'NULL');
                return strlen($str) > 60 ? substr($str, 0, 57) . '...' : $str;
            }, array_values($sample));
        }, $samples);

        $this->table($headers, $rows);

        // Show resolved file paths for each sample record
        foreach ($samples as $sample) {
            $sampleRecord = (object) $sample;
            $files = $migrator->resolveFiles($sampleRecord);

            $this->line('');
            $this->line("     Record #{$sampleRecord->id}:");

            if (!empty($files)) {
                foreach ($files as $f) {
                    $exists = file_exists($f['local_path']) ? '✅ Found' : '❌ Not on local disk';
                    $this->line("       {$exists}: {$f['local_path']}");
                    $this->line("         → will upload to: {$f['target_folder']}/{$f['original_name']}");
                }
            } else {
                // Show diagnostic info about WHY no files were resolved
                $this->warn("       No resolvable files. Diagnostic:");
                $this->diagnosticForRecord($migrator, $sampleRecord);
            }
        }
    }

    /**
     * Show diagnostic info explaining why a record has no resolvable files.
     */
    protected function diagnosticForRecord(\App\Services\FileMigration\FileMigratorInterface $migrator, object $record): void
    {
        $name = $migrator->getName();

        if ($name === 'custom_field_files') {
            $value = $record->value ?? '(empty)';
            $this->line("         Raw value: {$value}");

            // Try to show expected path
            if (!empty($record->value)) {
                $filenames = $this->parseFileValueForDiagnostic($record->value);
                foreach ($filenames as $fn) {
                    if (str_starts_with($fn, 'http')) {
                        $this->line("         {$fn} → already external URL (skip)");
                    } else {
                        $expectedPath = public_path('user-uploads/custom_fields/' . $fn);
                        $exists = file_exists($expectedPath);
                        $this->line("         Expected: {$expectedPath}");
                        $this->line('         Status: ' . ($exists ? '✅ exists' : '❌ file not found on local disk — will resolve on production server'));
                    }
                }
            }
        } elseif ($name === 'hibarr_deal_documents') {
            foreach (['deposit_confirmation', 'reservation_agreement', 'sales_contract'] as $col) {
                $val = $record->{$col} ?? null;
                if (empty($val)) continue;
                if (str_starts_with($val, 'http')) {
                    $this->line("         {$col}: already external URL");
                } elseif (str_starts_with($val, '{') || str_starts_with($val, '[')) {
                    $this->line("         {$col}: '{$val}' → JSON blob (not a filename, skipped)");
                } elseif (!str_contains($val, '.')) {
                    $this->line("         {$col}: '{$val}' → no file extension (not a filename, skipped)");
                } else {
                    $expectedPath = public_path('user-uploads/custom_fields/' . $val);
                    $exists = file_exists($expectedPath);
                    $this->line("         {$col}: expected {$expectedPath}");
                    $this->line('         Status: ' . ($exists ? '✅ exists' : '❌ file not found on local disk'));
                }
            }
        } elseif ($name === 'deal_files') {
            $hashname = $record->hashname ?? '(empty)';
            $dealId = $record->deal_id ?? '?';
            $expectedPath = public_path("user-uploads/lead-files/{$dealId}/{$hashname}");
            $exists = file_exists($expectedPath);
            $this->line("         Expected: {$expectedPath}");
            $this->line('         Status: ' . ($exists ? '✅ exists' : '❌ file not found on local disk'));
        }
    }

    /**
     * Parse a custom field value into filenames for diagnostic display.
     */
    protected function parseFileValueForDiagnostic(string $value): array
    {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            return array_values(array_filter($decoded, fn($f) => is_string($f) && $f !== ''));
        }
        if (str_contains($value, ',')) {
            $parts = array_filter(array_map('trim', explode(',', $value)), fn($f) => $f !== '');
            if (count($parts) > 1) return array_values($parts);
        }
        return [$value];
    }
}
