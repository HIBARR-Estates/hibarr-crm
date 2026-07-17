<?php

namespace App\Traits;

use App\Helper\Files;
use Illuminate\Support\Facades\Bus;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Session;
use Maatwebsite\Excel\HeadingRowImport;
use Maatwebsite\Excel\Imports\HeadingRowFormatter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use ReflectionClass;

trait ImportExcel
{
    /** @var array<int, \Illuminate\Bus\Batch|null> */
    protected array $importBatches = [];

    protected function applyImportResourceLimits(): void
    {
        @ini_set('memory_limit', '512M');
        @ini_set('max_execution_time', '600');
    }

    public function importFileProcess($request, $importClass)
    {
        $this->applyImportResourceLimits();
        // get class name from $importClass
        $this->importClassName = (new ReflectionClass($importClass))->getShortName();

        $this->file = Files::upload($request->import_file, Files::IMPORT_FOLDER);

        $importInstance = new $importClass;
        Excel::import($importInstance, public_path(Files::UPLOAD_FOLDER . '/' . Files::IMPORT_FOLDER . '/' . $this->file));
        $excelData = $importInstance->getProcessedData();
        if ($request->has('heading')) {
            array_shift($excelData);
        }

        $isDataNull = true;

        foreach ($excelData as $rowitem) {
            if (array_filter($rowitem)) {
                $isDataNull = false;
                break;
            }
        }

        if ($isDataNull) {
            return 'abort';
        }

        $this->hasHeading = $request->has('heading');
        $this->heading = array();
        $this->fileHeading = array();

        $this->columns = $importClass::fields();
        $this->importMatchedColumns = array();
        $this->matchedColumns = array();

        if ($this->hasHeading) {
            $this->heading = (new HeadingRowImport)->toArray(public_path(Files::UPLOAD_FOLDER . '/' . Files::IMPORT_FOLDER . '/' . $this->file))[0][0];

            // Excel Format None for get Heading Row Without Format and after change back to config
            HeadingRowFormatter::default('none');
            $this->fileHeading = (new HeadingRowImport)->toArray(public_path(Files::UPLOAD_FOLDER . '/' . Files::IMPORT_FOLDER . '/' . $this->file))[0][0];
            HeadingRowFormatter::default(config('excel.imports.heading_row.formatter'));

            array_shift($excelData);
            $this->matchedColumns = collect($this->columns)->whereIn('id', $this->heading)->pluck('id');
            $importMatchedColumns = array();

            foreach ($this->matchedColumns as $matchedColumn) {
                $importMatchedColumns[$matchedColumn] = 1;
            }

            $this->importMatchedColumns = $importMatchedColumns;
        }

        $this->importSample = array_slice($excelData, 0, 5);
    }

    public function importJobProcess($request, $importClass, $importJobClass)
    {
        $this->importBatches = [];
        $this->applyImportResourceLimits();
        // get class name from $importClass
        $importClassName = (new ReflectionClass($importClass))->getShortName();
        Log::info('Importing to queue: ' . $importClassName);

        // Signal all running queue workers to stop after their current job
        // so they release row-level locks on the jobs / failed_jobs tables.
        try {
            Artisan::call('queue:restart');
            // Give workers a moment to finish their current job and exit
            sleep(3);
        } catch (\Exception $e) {
            Log::warning('Could not restart queue workers: ' . $e->getMessage());
        }

        // Clear previous import — wrapped in try-catch because the DELETE
        // can hit a lock-wait timeout when a queue worker is still processing
        // jobs from a previous import.
        try {
            Artisan::call('queue:clear', [
                'connection' => 'database',
                '--queue' => $importClassName,
                '--force' => true,
            ]);
        } catch (\Exception $e) {
            Log::warning("Could not clear queue [{$importClassName}]: " . $e->getMessage());
        }

        try {
            Artisan::call('queue:flush');
        } catch (\Exception $e) {
            Log::warning('Could not flush failed jobs: ' . $e->getMessage());
        }
        // Get index of an array not null value with key
        $columns = array_filter($request->columns, function ($value) {
            return $value !== null;
        });
        
        // Ensure columns contains only string values (no objects)
        foreach ($columns as $key => $value) {
            if (is_object($value)) {
                $columns[$key] = (string) $value;
            }
        }

        Log::info('Starting Excel import', ['file' => $request->file, 'memory_before' => memory_get_usage(true) / 1024 / 1024 . 'MB']);
        
        $importInstance = new $importClass;
        Excel::import($importInstance, public_path(Files::UPLOAD_FOLDER . '/' . Files::IMPORT_FOLDER . '/' . $request->file));
        $excelData = $importInstance->getProcessedData();
        
        Log::info('Excel loaded', ['rows' => count($excelData), 'memory_after' => memory_get_usage(true) / 1024 / 1024 . 'MB']);

        if ($request->has_heading) {
            array_shift($excelData);
        }

        $totalCount = count($excelData);
        Session::put('leads_count', $totalCount);
        
        Log::info('Starting job creation', ['total_rows' => $totalCount, 'memory' => memory_get_usage(true) / 1024 / 1024 . 'MB']);

        // Get pipeline_id from request if provided
        $pipelineId = $request->pipeline_id ?? null;

        // Process in chunks to avoid memory exhaustion
        $chunkSize = 500; // Process 500 rows at a time
        $chunks = array_chunk($excelData, $chunkSize);
        
        // Clear original data to free memory
        unset($excelData);
        gc_collect_cycles();
        
        $allBatches = [];
        
        $company = company();
        $companyId = $company?->id;
        $userId = user()?->id;
        foreach ($chunks as $chunkIndex => $chunk) {
            $jobs = [];
            
            foreach ($chunk as $row) {
                // Ensure row data is primitive values only (no objects)
                $sanitizedRow = array_map(function($value) {
                    if ($value instanceof \PhpOffice\PhpSpreadsheet\RichText\RichText) {
                        return $value->getPlainText();
                    }
                    if (is_object($value) && method_exists($value, '__toString')) {
                        return (string) $value;
                    }
                    return $value;
                }, $row);

                switch ($importJobClass) {
                    case \App\Jobs\ImportDealJob::class:
                        $jobInstance = new $importJobClass($sanitizedRow, $columns, $companyId, $pipelineId);
                        break;
                    case \App\Jobs\ImportPropertyJob::class:
                        $jobInstance = new $importJobClass($sanitizedRow, $columns, $company, $userId);
                        break;
                    default:
                        $jobInstance = new $importJobClass($sanitizedRow, $columns, $company);
                        break;
                }

                $jobs[] = $jobInstance->onQueue($importClassName);
            }
            
            Log::info('Jobs created for chunk', ['chunk' => $chunkIndex, 'job_count' => count($jobs), 'memory' => memory_get_usage(true) / 1024 / 1024 . 'MB']);
            
            $batch = Bus::batch($jobs)->onConnection('database')->onQueue($importClassName)->name($importClassName . '_chunk_' . $chunkIndex);

            // Retry batch dispatch up to 3 times — the INSERT INTO jobs can
            // deadlock when a queue worker still holds row-level locks.
            $dispatched = null;
            $maxAttempts = 3;
            for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
                try {
                    $dispatched = $batch->dispatch();
                    break;
                } catch (\Exception $e) {
                    if ($attempt >= $maxAttempts) {
                        Log::error('Import failed: ' . $e->getMessage());
                        throw $e;
                    }
                    Log::warning("Batch dispatch attempt {$attempt} failed, retrying in 5s…", ['error' => $e->getMessage()]);
                    sleep(5);
                }
            }
            $allBatches[] = $dispatched;
            
            Log::info('Batch dispatched', ['chunk' => $chunkIndex, 'memory' => memory_get_usage(true) / 1024 / 1024 . 'MB']);
            
            // Clear memory after each chunk
            unset($jobs);
            gc_collect_cycles();
        }
        
        Log::info('All chunks processed', ['total_chunks' => count($allBatches)]);

        $this->importBatches = array_values(array_filter($allBatches));

        // Return the first batch for legacy single-batch tracking
        $batch = $this->importBatches[0] ?? null;

        Files::deleteFile($request->file, Files::IMPORT_FOLDER);

        return $batch;
    }

    /**
     * Drain an import queue within a strict job/time budget (legacy Blade flow polls
     * ImportController::getImportProgress for unbounded progress). When batch objects
     * are supplied, stop early once every batch has finished.
     *
     * @param  array<int, \Illuminate\Bus\Batch|null>  $batches
     */
    protected function runImportQueueUntilEmpty(string $queueName, array $batches = []): void
    {
        $maxJobsPerSlice = max(1, (int) (ini_get('max_execution_time') / 10));
        $budgetSeconds = min(55, max(10, (int) (ini_get('max_execution_time') / 5)));
        $deadline = microtime(true) + $budgetSeconds;

        while (microtime(true) < $deadline) {
            if ($batches !== [] && $this->importBatchesAreFinished($batches)) {
                return;
            }

            $exitCode = Artisan::call('queue:work', [
                'connection' => 'database',
                '--queue' => $queueName,
                '--max-jobs' => $maxJobsPerSlice,
                '--stop-when-empty' => true,
                '--tries' => 3,
            ]);

            if ($exitCode !== 0) {
                throw new \RuntimeException("Import queue worker exited with code {$exitCode}.");
            }

            if ($batches === [] || $this->importBatchesAreFinished($batches)) {
                return;
            }

            if (! $this->importQueueHasPendingJobs($queueName)) {
                break;
            }
        }
    }

    /**
     * @param  array<int, \Illuminate\Bus\Batch|null>  $batches
     * @return 'complete'|'failed'|'pending'
     */
    protected function assessImportBatches(array $batches): string
    {
        if ($batches === []) {
            return 'complete';
        }

        $hasPending = false;

        foreach ($batches as $batch) {
            if (! $batch) {
                continue;
            }

            $fresh = $batch->fresh();

            if (! $fresh) {
                continue;
            }

            if ($fresh->cancelled() || $fresh->hasFailures()) {
                return 'failed';
            }

            if (! $fresh->finished()) {
                $hasPending = true;
            }
        }

        return $hasPending ? 'pending' : 'complete';
    }

    /**
     * @param  array<int, \Illuminate\Bus\Batch|null>  $batches
     */
    protected function importBatchesAreFinished(array $batches): bool
    {
        if ($batches === []) {
            return true;
        }

        foreach ($batches as $batch) {
            if (! $batch) {
                continue;
            }

            $fresh = $batch->fresh();

            if (! $fresh) {
                continue;
            }

            if (! $fresh->finished()) {
                return false;
            }
        }

        return true;
    }

    protected function importQueueHasPendingJobs(string $queueName): bool
    {
        return DB::table('jobs')->where('queue', $queueName)->exists();
    }

}
