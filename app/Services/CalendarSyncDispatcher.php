<?php

namespace App\Services;

use App\Jobs\SyncCalendarEventJob;
use App\Models\DealFollowUp;
use App\Support\FeatureFlags;
use Illuminate\Support\Facades\Log;

/**
 * Schedules OL / Zoho calendar sync after meeting data is fully persisted
 * (including automation webhook updates such as meeting_link).
 */
class CalendarSyncDispatcher
{
    public function scheduleSync(DealFollowUp|int $followUp): void
    {
        if (!FeatureFlags::enabled('integrations.zoho-calendar-sync')) {
            return;
        }

        $followUpId = $followUp instanceof DealFollowUp ? (int) $followUp->id : (int) $followUp;
        if ($followUpId <= 0) {
            return;
        }

        $model = $followUp instanceof DealFollowUp
            ? $followUp
            : DealFollowUp::query()->find($followUpId);

        if (!$model || !$model->added_by) {
            return;
        }

        $model->update([
            'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
        ]);

        Log::info('CalendarSyncDispatcher: scheduling calendar sync', [
            'follow_up_id' => $followUpId,
            'has_meeting_link' => !empty($model->meeting_link),
        ]);

        // Run inline in the current process (the web request that saved the
        // meeting). Calendar sync must not depend on a separate queue:work
        // worker — only OL's own zoho-calendar worker handles the Zoho API call.
        SyncCalendarEventJob::dispatchSync($followUpId);
    }
}
