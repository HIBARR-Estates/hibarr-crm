<?php

namespace App\Services\CallRecording;

use App\Models\CallRecording;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Links a call recording to the call's timeline events (via `call_ref`), in
 * either order: when the upload finishes after the events (attach), and when
 * an event is logged after the upload finished (linkExisting).
 */
class CallRecordingLinker
{
    /**
     * Stamp `recording_id` into the metadata of every CRM event belonging to
     * this call, so the timeline row for the call shows that audio exists.
     *
     * The company id comes from the recording rather than the session, so this
     * does not depend on an authenticated company being resolvable.
     *
     * `call_ref` is a client-supplied string, so it must not be usable to
     * annotate another agent's call rows: only the uploader's own events (and
     * system rows that carry no user at all) are eligible.
     */
    public function attach(
        string $callRef,
        int $recordingId,
        ?int $companyId,
        ?int $ownerUserId = null,
    ): void {
        if ($companyId === null || $companyId <= 0) {
            return;
        }

        try {
            $events = \App\Models\CrmEvent::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereHas('eventType', fn ($q) => $q->whereIn('slug', ['call_started', 'call_ended', 'call_declined']))
                ->where('metadata->call_ref', $callRef)
                ->where(function ($q) use ($ownerUserId) {
                    $q->whereNull('user_id');

                    if ($ownerUserId !== null) {
                        $q->orWhere('user_id', $ownerUserId);
                    }
                })
                ->get();

            $isForwarded = false;
            $forwardedUserId = null;
            $forwardedUserName = null;

            // Derive forwarding attribution from trusted call events matching this call_ref,
            // rather than trusting client upload fields.
            foreach ($events as $event) {
                $meta = is_array($event->metadata) ? $event->metadata : [];
                if (! empty($meta['is_forwarded']) && ! empty($meta['forwarded_from_user_id'])) {
                    $candidateId = (int) $meta['forwarded_from_user_id'];
                    $targetCompanyId = $companyId ?? company()?->id;
                    $forwardedUser = User::query()
                        ->when($targetCompanyId, fn ($q) => $q->where('company_id', $targetCompanyId))
                        ->find($candidateId);

                    if ($forwardedUser) {
                        $isForwarded = true;
                        $forwardedUserId = (int) $forwardedUser->id;
                        $forwardedUserName = (string) $forwardedUser->name;
                        break;
                    }
                }
            }

            foreach ($events as $event) {
                $metadata = is_array($event->metadata) ? $event->metadata : [];
                if (isset($metadata['recording_id'])) {
                    continue;
                }
                $metadata['recording_id'] = $recordingId;
                $metadata['has_recording'] = true;
                unset($metadata['recording_status'], $metadata['recording_error']);
                if ($isForwarded && $forwardedUserId !== null) {
                    $metadata['is_forwarded'] = true;
                    $metadata['forwarded_from_user_id'] = $forwardedUserId;
                    $metadata['forwarded_from_user_name'] = $forwardedUserName;
                }
                $metadata['has_recording'] = true;
                $event->forceFill(['metadata' => $metadata])->save();
            }
        } catch (\Throwable $e) {
            // Never fail the upload because the timeline could not be annotated.
            Log::warning('CallRecordingController: could not annotate call events', [
                'call_ref' => $callRef,
                'recording_id' => $recordingId,
                'message' => $e->getMessage(),
            ]);
        }
    }

    /**
     * An event logged after its recording was uploaded (the upload can beat
     * "call ended"): find the uploader's recording for this call and stamp it
     * on the call's events, the new one included.
     */
    public function linkExisting(string $callRef, int $companyId, int $userId): void
    {
        $recording = CallRecording::query()
            ->where('company_id', $companyId)
            ->where('call_ref', $callRef)
            ->where('user_id', $userId)
            ->latest('id')
            ->first(['id', 'company_id', 'user_id']);

        if ($recording === null) {
            return;
        }

        $this->attach($callRef, (int) $recording->id, $companyId, $userId);
    }
}
