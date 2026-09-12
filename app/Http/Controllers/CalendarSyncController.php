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
        $this->authorizeSyncAccess($followUp);

        $jobId = $followUp->zoho_calendar_job_id;

        // The OL create/retry calls are made here so the UI can immediately
        // receive the new jobId (or OL's actual error when it's rejected).
        $newJobId = $jobId
            ? $syncService->retryEvent((string) $jobId)
            : $syncService->enqueueEvent($followUp, CalendarSyncService::PLATFORM_ZOHO);

        if ($newJobId) {
            // Quiet — calendar bookkeeping must not fire meeting-update notifications.
            $followUp->updateQuietly([
                'zoho_calendar_job_id' => $newJobId,
                'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
                'zoho_calendar_event_uid' => null,
                'zoho_calendar_sync_error' => null,
            ]);

            return response()->json(Reply::successWithData('Calendar sync updated', [
                'data' => $this->syncData($followUp),
            ]));
        }

        $error = $syncService->lastError()
            ?? ['code' => 'sync_failed', 'message' => 'Calendar sync failed.'];

        $followUp->updateQuietly([
            'zoho_calendar_job_id' => null,
            'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
            'zoho_calendar_sync_error' => $error['message'],
        ]);

        // A failure status, not 200 — a rejected sync must not read as a
        // successful request in the browser.
        return response()->json(
            Reply::error($error['message'], 'calendar_sync_failed', $this->syncData($followUp, $error)),
            422
        );
    }

    public function status(DealFollowUp $followUp, CalendarSyncService $syncService): JsonResponse
    {
        $this->authorizeSyncAccess($followUp);

        $jobId = $followUp->zoho_calendar_job_id;
        if (! $jobId) {
            // No OL job: either the sync dispatched after the save hasn't run
            // yet (pending), or OL rejected it outright (failed + stored reason).
            return $this->statusResponse($followUp, $this->storedError($followUp));
        }

        $data = $syncService->getJobStatus((string) $jobId);

        if ($data === null) {
            return $this->statusResponse(
                $followUp,
                $this->storedError($followUp),
                $followUp->zoho_calendar_sync_status ?? DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING
            );
        }

        $httpStatus = $data['_httpStatus'] ?? null;
        unset($data['_httpStatus']);

        if ($httpStatus === 404) {
            $error = is_array($data['error'] ?? null) && isset($data['error']['message'])
                ? ['code' => (string) ($data['error']['code'] ?? '404'), 'message' => (string) $data['error']['message']]
                : ['code' => '404', 'message' => 'Calendar job or linked profile not found'];

            $this->markFailed($followUp, $error);

            return $this->statusResponse($followUp, $error);
        }

        $olStatus = (string) ($data['status'] ?? '');
        $error = $this->normalizeError($data['error'] ?? null);

        if ($olStatus === 'failed' || $error !== null) {
            $error ??= ['code' => 'failed', 'message' => 'Calendar sync failed.'];
            $this->markFailed($followUp, $error);

            return $this->statusResponse($followUp, $error);
        }

        if ($olStatus === 'completed') {
            $eventUid = $data['zohoEventId'] ?? null;
            $followUp->updateQuietly([
                'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_SYNCED,
                'zoho_calendar_sync_error' => null,
                'zoho_calendar_event_uid' => is_string($eventUid) && $eventUid !== ''
                    ? $eventUid
                    : $followUp->zoho_calendar_event_uid,
            ]);

            return $this->statusResponse($followUp, null);
        }

        // pending / processing / unknown → keep pending
        $followUp->updateQuietly([
            'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
        ]);

        return $this->statusResponse($followUp, null);
    }

    /**
     * The meeting's creator or host (the Zoho organizer whose calendar this
     * is), and only while calendar sync is switched on.
     */
    private function authorizeSyncAccess(DealFollowUp $followUp): void
    {
        $userId = (int) user()->id;

        abort_403($userId !== (int) $followUp->added_by && $userId !== (int) $followUp->host_id);
        abort_403(! FeatureFlags::enabled('integrations.zoho-calendar-sync'));
    }

    /**
     * @param  array{code: string, message: string}  $error
     */
    private function markFailed(DealFollowUp $followUp, array $error): void
    {
        $followUp->updateQuietly([
            'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
            'zoho_calendar_sync_error' => $error['message'],
        ]);
    }

    /**
     * @return array{code: string, message: string}|null
     */
    private function storedError(DealFollowUp $followUp): ?array
    {
        if ($followUp->zoho_calendar_sync_status !== DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED) {
            return null;
        }

        return [
            'code' => 'sync_failed',
            'message' => $followUp->zoho_calendar_sync_error ?: 'Calendar sync failed.',
        ];
    }

    /**
     * @return array{code: string, message: string}|null
     */
    private function normalizeError(mixed $error): ?array
    {
        if (is_string($error) && $error !== '') {
            return ['code' => 'error', 'message' => $error];
        }

        if (is_array($error) && isset($error['message']) && is_string($error['message'])) {
            return ['code' => (string) ($error['code'] ?? 'error'), 'message' => $error['message']];
        }

        return null;
    }

    /**
     * @param  array{code: string, message: string}|null  $error
     * @return array<string, mixed>
     */
    private function syncData(DealFollowUp $followUp, ?array $error = null): array
    {
        return [
            'jobId' => $followUp->zoho_calendar_job_id,
            'syncStatus' => $followUp->zoho_calendar_sync_status,
            'eventUid' => $followUp->zoho_calendar_event_uid,
            'error' => $error,
        ];
    }

    /**
     * @param  array{code: string, message: string}|null  $error
     */
    private function statusResponse(DealFollowUp $followUp, ?array $error, ?string $syncStatus = null): JsonResponse
    {
        $data = $this->syncData($followUp, $error);
        if ($syncStatus !== null) {
            $data['syncStatus'] = $syncStatus;
        }

        return response()->json(Reply::successWithData('Calendar sync status', ['data' => $data]));
    }
}
