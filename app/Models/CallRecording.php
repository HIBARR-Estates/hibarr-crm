<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CallRecording extends Model
{
    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function device(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(\App\Models\SoftphoneDevice::class, 'device_id');
    }

    protected $fillable = [
        'company_id',
        'user_id',
        'entity_type',
        'entity_id',
        'device_id',
        'lead_name',
        'phone_number',
        'direction',
        'routing_reason',
        'filename',
        'mime_type',
        'size',
        'duration_seconds',
        'object_path',
        'external_url',
        'expires_at',
        // Shared with crm_events.metadata.call_ref so the timeline can find the
        // recording for a call. Without it here the create() below silently
        // dropped it and no timeline row could ever be annotated.
        'call_ref',
        'ol_synced_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        // Set once OL's call bridge stored the recording (see
        // SyncCallRecordingToCallBridgeJob).
        'ol_synced_at' => 'datetime',
    ];

    /** Recorded in a WebM container (older uploads, before transcoding). */
    public function isWebm(): bool
    {
        return str_contains(strtolower((string) $this->mime_type), 'webm')
            || str_ends_with(strtolower((string) $this->filename), '.webm');
    }

    /**
     * WebM uploads were filed by Bunny as video, so their link is a Bunny
     * Stream player page rather than an audio file: it cannot play inline
     * and is opened in a new tab instead.
     */
    public function opensInNewTab(): bool
    {
        return $this->isWebm() && ! empty($this->external_url);
    }
}
