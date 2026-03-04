<?php

namespace App\Jobs;

use App\Services\FileMigration\FileMigrationService;
use App\Services\FileStorageService;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * MigrateFileJob
 *
 * A queued job that uploads a single record's file(s) from local storage
 * to the external storage API and updates the database reference.
 *
 * Dispatched in batches by the files:migrate-external Artisan command.
 * Uses the Batchable trait for Bus::batch() support.
 *
 * The FileStorageService already has internal retry logic (exponential backoff),
 * so this job uses $tries = 1 to avoid double-retrying.
 */
class MigrateFileJob implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Number of times the job may be attempted.
     * FileStorageService has its own retry logic, so we only attempt once at the job level.
     */
    public int $tries = 1;

    /**
     * Timeout in seconds — generous for large files over slow connections.
     */
    public int $timeout = 300;

    public function __construct(
        protected string $migratorName,
        protected int $recordId,
    ) {}

    /**
     * Execute the job.
     */
    public function handle(FileStorageService $storage): void
    {
        // If the batch has been cancelled, skip
        if ($this->batch()?->cancelled()) {
            return;
        }

        $service = FileMigrationService::withDefaultMigrators();
        $migrator = $service->getMigrator($this->migratorName);

        // Fetch the record — it may have been deleted or already migrated
        $record = $migrator->findById($this->recordId);

        if (!$record) {
            Log::info("MigrateFileJob: Record {$this->migratorName}#{$this->recordId} not found or already migrated, skipping.");
            return;
        }

        // Resolve local files for this record
        $files = $migrator->resolveFiles($record);

        if (empty($files)) {
            Log::info("MigrateFileJob: No local files found for {$this->migratorName}#{$this->recordId}, skipping.");
            return;
        }

        $uploadedCount = 0;
        $failedCount = 0;

        foreach ($files as $fileEntry) {
            $localPath = $fileEntry['local_path'];
            $originalName = $fileEntry['original_name'];
            $targetFolder = $fileEntry['target_folder'];
            $column = $fileEntry['column'] ?? 'default';

            try {
                if (!file_exists($localPath)) {
                    Log::warning("MigrateFileJob: File not found on disk", [
                        'migrator'  => $this->migratorName,
                        'record_id' => $this->recordId,
                        'path'      => $localPath,
                    ]);
                    $failedCount++;
                    continue;
                }

                // Upload to external storage
                $result = $storage->uploadFromPath($localPath, $originalName, $targetFolder);

                // Update the database record
                $migrator->applyResult($record, $column, $result);

                $uploadedCount++;

                Log::info("MigrateFileJob: Successfully migrated file", [
                    'migrator'     => $this->migratorName,
                    'record_id'    => $this->recordId,
                    'column'       => $column,
                    'download_url' => $result['downloadUrl'],
                ]);
            } catch (\Exception $e) {
                $failedCount++;

                Log::error("MigrateFileJob: Failed to migrate file", [
                    'migrator'  => $this->migratorName,
                    'record_id' => $this->recordId,
                    'column'    => $column,
                    'path'      => $localPath,
                    'error'     => $e->getMessage(),
                ]);
            }
        }

        if ($failedCount > 0 && $uploadedCount === 0) {
            // All files failed for this record — throw so it appears in failed_jobs
            throw new \RuntimeException(
                "All {$failedCount} file(s) failed to migrate for {$this->migratorName}#{$this->recordId}"
            );
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error("MigrateFileJob: Job failed permanently", [
            'migrator'  => $this->migratorName,
            'record_id' => $this->recordId,
            'error'     => $exception->getMessage(),
        ]);
    }

    /**
     * Get display info for logging/monitoring.
     */
    public function displayName(): string
    {
        return "MigrateFile:{$this->migratorName}#{$this->recordId}";
    }
}
