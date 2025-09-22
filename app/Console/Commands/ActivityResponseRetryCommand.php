<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ActivityResponseRetryQueue;
use App\Jobs\ActivityResponseRetryJob;

class ActivityResponseRetryCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'activity:retry-queue 
                            {action : Action to perform (process|stats|cleanup|retry-failed)}
                            {--limit=50 : Limit number of items to process}
                            {--channel= : Filter by specific channel}
                            {--days=30 : Days for cleanup}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Manage the activity response retry queue';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $action = $this->argument('action');

        switch ($action) {
            case 'process':
                $this->processRetryQueue();
                break;
            case 'stats':
                $this->showStats();
                break;
            case 'cleanup':
                $this->cleanup();
                break;
            case 'retry-failed':
                $this->retryFailed();
                break;
            default:
                $this->error("Invalid action: {$action}");
                $this->line('Valid actions: process, stats, cleanup, retry-failed');
                return 1;
        }

        return 0;
    }

    /**
     * Process pending retry queue items
     */
    protected function processRetryQueue()
    {
        $limit = $this->option('limit');
        $channel = $this->option('channel');

        $query = ActivityResponseRetryQueue::readyForRetry();
        
        if ($channel) {
            $query->forChannel($channel);
        }

        $items = $query->limit($limit)->get();

        if ($items->isEmpty()) {
            $this->info('No items ready for retry.');
            return;
        }

        $this->info("Processing {$items->count()} items...");

        $processed = 0;
        $failed = 0;

        foreach ($items as $item) {
            try {
                // Dispatch retry job
                ActivityResponseRetryJob::dispatch(
                    $item->id,
                    $item->original_data,
                    $item->original_headers ?? [],
                        60 // 60 seconds timeout
                );

                $processed++;
                $this->line("Queued retry for item {$item->id} (Channel: {$item->channel})");
            } catch (\Exception $e) {
                $failed++;
                $this->error("Failed to queue retry for item {$item->id}: {$e->getMessage()}");
            }
        }

        $this->info("Processed: {$processed}, Failed: {$failed}");
    }

    /**
     * Show retry queue statistics
     */
    protected function showStats()
    {
        $total = ActivityResponseRetryQueue::count();
        $pending = ActivityResponseRetryQueue::where('status', ActivityResponseRetryQueue::STATUS_PENDING)->count();
        $processing = ActivityResponseRetryQueue::where('status', ActivityResponseRetryQueue::STATUS_PROCESSING)->count();
        $completed = ActivityResponseRetryQueue::where('status', ActivityResponseRetryQueue::STATUS_COMPLETED)->count();
        $failed = ActivityResponseRetryQueue::where('status', ActivityResponseRetryQueue::STATUS_FAILED)->count();

        $readyForRetry = ActivityResponseRetryQueue::readyForRetry()->count();

        $this->info('Activity Response Retry Queue Statistics');
        $this->line('==========================================');
        $this->line("Total Items: {$total}");
        $this->line("Pending: {$pending}");
        $this->line("Processing: {$processing}");
        $this->line("Completed: {$completed}");
        $this->line("Failed: {$failed}");
        $this->line("Ready for Retry: {$readyForRetry}");

        // Show channel breakdown
        $channels = ActivityResponseRetryQueue::selectRaw('channel, status, count(*) as count')
            ->groupBy('channel', 'status')
            ->orderBy('channel')
            ->get();

        if ($channels->isNotEmpty()) {
            $this->line('');
            $this->info('Channel Breakdown:');
            $this->table(
                ['Channel', 'Status', 'Count'],
                $channels->map(fn($item) => [
                    $item->channel ?? 'Unknown',
                    ucfirst($item->status),
                    $item->count
                ])
            );
        }

        // Show recent activity
        $recent = ActivityResponseRetryQueue::orderBy('updated_at', 'desc')
            ->limit(5)
            ->get();

        if ($recent->isNotEmpty()) {
            $this->line('');
            $this->info('Recent Activity:');
            $this->table(
                ['ID', 'Channel', 'Status', 'Attempts', 'Updated'],
                $recent->map(fn($item) => [
                    $item->id,
                    $item->channel ?? 'Unknown',
                    ucfirst($item->status),
                    $item->attempts,
                    $item->updated_at->format('Y-m-d H:i:s')
                ])
            );
        }
    }

    /**
     * Cleanup old completed/failed items
     */
    protected function cleanup()
    {
        $days = $this->option('days');
        $cutoffDate = now()->subDays($days);

        $completed = ActivityResponseRetryQueue::where('status', ActivityResponseRetryQueue::STATUS_COMPLETED)
            ->where('completed_at', '<', $cutoffDate)
            ->count();

        $failed = ActivityResponseRetryQueue::where('status', ActivityResponseRetryQueue::STATUS_FAILED)
            ->where('failed_at', '<', $cutoffDate)
            ->count();

        if ($completed === 0 && $failed === 0) {
            $this->info("No items to cleanup older than {$days} days.");
            return;
        }

        if ($this->confirm("Delete {$completed} completed and {$failed} failed items older than {$days} days?")) {
            $deletedCompleted = ActivityResponseRetryQueue::where('status', ActivityResponseRetryQueue::STATUS_COMPLETED)
                ->where('completed_at', '<', $cutoffDate)
                ->delete();

            $deletedFailed = ActivityResponseRetryQueue::where('status', ActivityResponseRetryQueue::STATUS_FAILED)
                ->where('failed_at', '<', $cutoffDate)
                ->delete();

            $this->info("Cleaned up {$deletedCompleted} completed and {$deletedFailed} failed items.");
        }
    }

    /**
     * Retry failed items
     */
    protected function retryFailed()
    {
        $limit = $this->option('limit');
        $channel = $this->option('channel');

        $query = ActivityResponseRetryQueue::failed();
        
        if ($channel) {
            $query->forChannel($channel);
        }

        $items = $query->limit($limit)->get();

        if ($items->isEmpty()) {
            $this->info('No failed items found.');
            return;
        }

        if ($this->confirm("Reset {$items->count()} failed items back to pending status?")) {
            $reset = 0;
            foreach ($items as $item) {
                $item->update([
                    'status' => ActivityResponseRetryQueue::STATUS_PENDING,
                    'attempts' => 0,
                    'next_retry_at' => now(),
                    'failed_at' => null,
                    'error_message' => null
                ]);
                $reset++;
            }
            $this->info("Reset {$reset} failed items back to pending status.");
        }
    }
}
