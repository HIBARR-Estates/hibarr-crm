<?php

namespace App\Traits;

use App\Helper\Files;
use Illuminate\Support\Facades\Bus;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Session;
use Maatwebsite\Excel\HeadingRowImport;
use Maatwebsite\Excel\Imports\HeadingRowFormatter;
use Illuminate\Support\Facades\Log;
use ReflectionClass;

trait ImportExcel
{

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
        
        // Return the first batch for tracking
        $batch = $allBatches[0] ?? null;

        Files::deleteFile($request->file, Files::IMPORT_FOLDER);

        return $batch;
    }

    /**
     * Process all jobs on an import-specific queue inline. The legacy Blade import
     * flow polls ImportController::getImportProgress for this; the Inertia upload
     * path must invoke it directly or jobs sit unprocessed unless a worker listens
     * on the import queue name (e.g. LeadImport).
     */
    protected function runImportQueueUntilEmpty(string $queueName): void
    {
        try {
            Artisan::call('queue:work', [
                'connection' => 'database',
                '--queue' => $queueName,
                '--stop-when-empty' => true,
                '--tries' => 3,
            ]);
        } catch (\Exception $e) {
            Log::warning("Could not process import queue [{$queueName}]: " . $e->getMessage());
        }
    }

}
