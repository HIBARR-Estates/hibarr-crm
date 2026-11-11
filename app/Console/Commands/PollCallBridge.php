<?php

namespace App\Console\Commands;

use App\Services\CallBridge\CallBridgeService;
use Illuminate\Console\Command;

/**
 * Scheduled bridge poller: pulls call events from OL's call bridge and
 * projects them onto the CRM timeline plus open call/callback tasks.
 *
 * Frequency should track services.call_bridge.poll_interval (default 30s —
 * everyMinute is the finest a cron schedule offers without a beat schedule).
 */
class PollCallBridge extends Command
{
    protected $signature = 'call-bridge:poll
                            {--limit=100 : Max events fetched per request}';

    protected $description = 'Poll OL call bridge for call events and log them to the CRM timeline';

    public function handle(CallBridgeService $bridge): int
    {
        $summary = $bridge->poll((int) $this->option('limit'));

        $this->info(sprintf(
            'Call bridge poll: %d fetched, %d logged, %d skipped, %d errors.',
            $summary['fetched'],
            $summary['logged'],
            $summary['skipped'],
            $summary['errors'],
        ));

        return $summary['errors'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
