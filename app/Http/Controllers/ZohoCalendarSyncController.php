<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Jobs\SyncZohoCalendarEventJob;
use App\Models\DealFollowUp;
use App\Models\EmployeeDetails;
use App\Services\ZohoCalendarSyncService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;

class ZohoCalendarSyncController extends AccountBaseController
{
    public function retry(DealFollowUp $followUp, ZohoCalendarSyncService $syncService): JsonResponse
    {
        abort_403((int) $followUp->added_by !== (int) user()->id);

        if (!FeatureFlags::enabled('integrations.zoho-calendar-sync')) {
            abort_403(true);
        }

        $hasLinkedZohoProfile = EmployeeDetails::query()
            ->where('user_id', user()->id)
            ->whereNotNull('zoho_id')
            ->exists();

        abort_403(!$hasLinkedZohoProfile);

        $jobId = $followUp->zoho_calendar_job_id;

        // The OL create/retry calls are made here so the UI can immediately
        // receive the new jobId (or get failed status when retry isn't possible).
        $newJobId = $jobId
            ? $syncService->retryEvent((string) $jobId)
            : $syncService->enqueueEvent($followUp);

        if ($newJobId) {
            $followUp->update([
                'zoho_calendar_job_id' => $newJobId,
                'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
            ]);
        } else {
            $followUp->update([
                'zoho_calendar_job_id' => null,
                'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
            ]);
        }

        return response()->json(Reply::successWithData(
            'Zoho calendar sync updated',
            [
                'data' => [
                    'jobId' => $followUp->zoho_calendar_job_id,
                    'syncStatus' => $followUp->zoho_calendar_sync_status,
                ],
            ]
        ));
    }
}

