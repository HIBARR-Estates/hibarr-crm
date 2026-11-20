<?php

namespace App\Support;

use App\Models\CallRecording;
use App\Models\CrmEvent;

/**
 * Who a call ref belongs to.
 *
 * A call ref is a client-supplied string that links a call's timeline rows,
 * its recording and OL's call log. Nothing makes it unique across tenants, so
 * before one company stores or forwards a ref, it checks that no other
 * company already uses it.
 */
final class CallRefOwnership
{
    /** Call refs only live for the length of a call and its upload. */
    private const LOOKBACK_DAYS = 30;

    /** The call event types the softphone writes a call ref onto. */
    private const CALL_EVENT_SLUGS = [
        'call_started', 'call_ended', 'call_declined', 'call_missed',
        'call_failed', 'call_busy', 'call_voicemail',
    ];

    /**
     * True when any other company already uses the ref, whether or not this
     * company uses it too — a ref shared across tenants cannot be trusted
     * for either.
     */
    public static function belongsToAnotherCompany(string $callRef, ?int $companyId): bool
    {
        $callRef = trim($callRef);
        if ($callRef === '') {
            return false;
        }
        if ($companyId === null || $companyId <= 0) {
            return true;
        }

        // `call_recordings.call_ref` is indexed: the cheap check first.
        $recordingElsewhere = CallRecording::withoutGlobalScopes()
            ->where('call_ref', $callRef)
            ->where(fn ($q) => $q->whereNull('company_id')->orWhere('company_id', '!=', $companyId))
            ->exists();

        if ($recordingElsewhere) {
            return true;
        }

        // Timeline rows carry the ref in JSON metadata, so the scan is kept to
        // the call event types and to recent rows.
        return CrmEvent::withoutGlobalScopes()
            ->where('company_id', '!=', $companyId)
            ->where('created_at', '>=', now()->subDays(self::LOOKBACK_DAYS))
            ->whereHas('eventType', fn ($q) => $q->whereIn('slug', self::CALL_EVENT_SLUGS))
            ->where('metadata->call_ref', $callRef)
            ->exists();
    }
}
