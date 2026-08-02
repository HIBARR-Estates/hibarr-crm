<?php

namespace App\Jobs;

use App\Services\CalendarSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class DeleteCalendarSyncEventJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 30;

    public function __construct(
        private readonly string $eventUid,
        private readonly int $creatorUserId,
        private readonly ?int $followUpId = null,
    ) {
    }

    public function handle(CalendarSyncService $syncService): void
    {
        $ok = $syncService->deleteEvent($this->eventUid, $this->creatorUserId);

        if (!$ok) {
            Log::warning('DeleteCalendarSyncEventJob: OL delete failed', [
                'event_uid' => $this->eventUid,
                'creator_user_id' => $this->creatorUserId,
                'follow_up_id' => $this->followUpId,
            ]);
        }
    }

    public function failed(Throwable $exception): void
    {
        Log::error('DeleteCalendarSyncEventJob exhausted retries', [
            'event_uid' => $this->eventUid,
            'creator_user_id' => $this->creatorUserId,
            'follow_up_id' => $this->followUpId,
            'error' => $exception->getMessage(),
        ]);
    }
}
