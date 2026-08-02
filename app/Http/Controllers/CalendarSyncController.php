<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\DealFollowUp;
use App\Services\CalendarSyncService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;

class CalendarSyncController extends AccountBaseController
{
    public function retry(DealFollowUp $followUp, CalendarSyncService $syncService): JsonResponse
    {
        abort_403((int) $followUp->added_by !== (int) user()->id);

        if (!FeatureFlags::enabled('integrations.zoho-calendar-sync')) {
            abort_403(true);
        }

        $jobId = $followUp->zoho_calendar_job_id;

        // The OL create/retry calls are made here so the UI can immediately
        // receive the new jobId (or get failed status when retry isn't possible).
        $newJobId = $jobId
            ? $syncService->retryEvent((string) $jobId)
            : $syncService->enqueueEvent($followUp, CalendarSyncService::PLATFORM_ZOHO);

        if ($newJobId) {
            $followUp->update([
                'zoho_calendar_job_id' => $newJobId,
                'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
                'zoho_calendar_event_uid' => null,
            ]);
        } else {
            $followUp->update([
                'zoho_calendar_job_id' => null,
                'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
            ]);
        }

        return response()->json(Reply::successWithData(
            'Calendar sync updated',
            [
                'data' => [
                    'jobId' => $followUp->zoho_calendar_job_id,
                    'syncStatus' => $followUp->zoho_calendar_sync_status,
                    'eventUid' => $followUp->zoho_calendar_event_uid,
                ],
            ]
        ));
    }

    public function status(DealFollowUp $followUp, CalendarSyncService $syncService): JsonResponse
    {
        abort_403((int) $followUp->added_by !== (int) user()->id);

        if (!FeatureFlags::enabled('integrations.zoho-calendar-sync')) {
            abort_403(true);
        }

        $jobId = $followUp->zoho_calendar_job_id;
        if (!$jobId) {
            return response()->json(Reply::successWithData(
                'Calendar sync status',
                [
                    'data' => [
                        'jobId' => null,
                        'syncStatus' => $followUp->zoho_calendar_sync_status,
                        'eventUid' => $followUp->zoho_calendar_event_uid,
                        'error' => null,
                    ],
                ]
            ));
        }

        $data = $syncService->getJobStatus((string) $jobId);

        if ($data === null) {
            return response()->json(Reply::successWithData(
                'Calendar sync status',
                [
                    'data' => [
                        'jobId' => $jobId,
                        'syncStatus' => $followUp->zoho_calendar_sync_status
                            ?? DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
                        'eventUid' => $followUp->zoho_calendar_event_uid,
                        'error' => null,
                    ],
                ]
            ));
        }

        $httpStatus = $data['_httpStatus'] ?? null;
        unset($data['_httpStatus']);

        if ($httpStatus === 404) {
            $followUp->update([
                'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
            ]);

            $error = is_array($data['error'] ?? null)
                ? $data['error']
                : ['code' => '404', 'message' => 'Calendar job or linked profile not found'];

            return response()->json(Reply::successWithData(
                'Calendar sync status',
                [
                    'data' => [
                        'jobId' => $jobId,
                        'syncStatus' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
                        'eventUid' => $followUp->zoho_calendar_event_uid,
                        'error' => $error,
                    ],
                ]
            ));
        }

        $olStatus = (string) ($data['status'] ?? '');
        $error = $data['error'] ?? null;
        if (is_string($error)) {
            $error = ['code' => 'error', 'message' => $error];
        }

        if ($olStatus === 'failed' || $error) {
            $followUp->update([
                'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
            ]);

            return response()->json(Reply::successWithData(
                'Calendar sync status',
                [
                    'data' => [
                        'jobId' => $jobId,
                        'syncStatus' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
                        'eventUid' => $followUp->zoho_calendar_event_uid,
                        'error' => is_array($error) ? $error : null,
                    ],
                ]
            ));
        }

        if ($olStatus === 'completed') {
            $eventUid = $data['zohoEventId'] ?? null;
            $followUp->update([
                'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_SYNCED,
                'zoho_calendar_event_uid' => is_string($eventUid) && $eventUid !== ''
                    ? $eventUid
                    : $followUp->zoho_calendar_event_uid,
            ]);

            return response()->json(Reply::successWithData(
                'Calendar sync status',
                [
                    'data' => [
                        'jobId' => $jobId,
                        'syncStatus' => DealFollowUp::ZOHO_CALENDAR_SYNC_SYNCED,
                        'eventUid' => $followUp->zoho_calendar_event_uid,
                        'error' => null,
                    ],
                ]
            ));
        }

        // pending / processing / unknown → keep pending
        $followUp->update([
            'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
        ]);

        return response()->json(Reply::successWithData(
            'Calendar sync status',
            [
                'data' => [
                    'jobId' => $jobId,
                    'syncStatus' => DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
                    'eventUid' => $followUp->zoho_calendar_event_uid,
                    'error' => null,
                ],
            ]
        ));
    }
}
