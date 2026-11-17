<?php

namespace App\Jobs;

use App\Models\CallRecording;
use App\Models\CrmEvent;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use App\Services\CallBridge\CallBridgeClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Register a softphone recording with OL's call bridge so OL's call log holds
 * it as well as the CRM.
 *
 * Queued so the upload response never waits on OL, and retried with backoff
 * because a recording that never reaches OL is not otherwise reconciled.
 * OL upserts on (call_ref, track), so a retry is harmless.
 */
class SyncCallRecordingToCallBridgeJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    public int $timeout = 30;

    /** @var array<int, int> */
    public array $backoff = [30, 120, 600, 1800];

    public function __construct(
        public readonly int $recordingId,
    ) {}

    public function handle(CallBridgeClient $client): void
    {
        if (! $client->configured()) {
            return;
        }

        $recording = CallRecording::withoutGlobalScopes()->find($this->recordingId);
        if ($recording === null || empty($recording->call_ref)) {
            return;
        }

        // An expired recording is no longer served by the CRM, so its link is
        // not handed to OL either.
        if ($recording->expires_at !== null && $recording->expires_at->isPast()) {
            return;
        }

        // The call ref comes from the browser. OL files the recording under
        // it, so a ref that only ever appears on another company's calls must
        // not be forwarded from this one.
        if ($this->callRefBelongsToAnotherCompany((string) $recording->call_ref, $recording->company_id)) {
            Log::warning('SyncCallRecordingToCallBridgeJob: call ref belongs to another company; not sent to OL', [
                'recording_id' => $recording->id,
                'company_id' => $recording->company_id,
            ]);

            return;
        }

        $entityType = match ($recording->entity_type) {
            'lead', Lead::class => 'lead',
            'deal', Deal::class => 'deal',
            default => null,
        };

        $agentEmail = $recording->user_id
            ? User::withoutGlobalScopes()->whereKey($recording->user_id)->value('email')
            : null;

        try {
            $response = $client->emitRecording([
                'callRef' => (string) $recording->call_ref,
                'crmRecordingId' => (int) $recording->id,
                'url' => $recording->external_url,
                'mimeType' => $recording->mime_type,
                'sizeBytes' => $recording->size,
                'durationSeconds' => $recording->duration_seconds,
                'expiresAt' => $recording->expires_at?->toIso8601String(),
                'direction' => $recording->direction,
                'phoneNumber' => $recording->phone_number,
                'agentEmail' => $agentEmail,
                'entityType' => $entityType,
                'entityId' => $entityType !== null ? $recording->entity_id : null,
            ]);

            // OL answers `persisted: false` when the call's log row does not
            // exist yet (the upload often beats the call events). That is not
            // done: fail this attempt so the queue retries it with backoff.
            if (($response['persisted'] ?? null) === false) {
                throw new \RuntimeException('OL has no call log for this call ref yet; recording not stored.');
            }
        } catch (\Throwable $e) {
            Log::warning('SyncCallRecordingToCallBridgeJob: OL rejected or unreachable', [
                'recording_id' => $recording->id,
                'call_ref' => $recording->call_ref,
                'attempt' => $this->attempts(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * True when the ref is on another company's call timeline and never on
     * this company's. A ref seen nowhere yet is allowed: the call's own
     * events often land after the upload.
     */
    private function callRefBelongsToAnotherCompany(string $callRef, mixed $companyId): bool
    {
        if ($companyId === null) {
            return true;
        }

        $owners = CrmEvent::withoutGlobalScopes()
            ->where('metadata->call_ref', $callRef)
            ->distinct()
            ->limit(10)
            ->pluck('company_id')
            ->map(fn ($id) => (int) $id);

        return $owners->isNotEmpty() && ! $owners->contains((int) $companyId);
    }
}
