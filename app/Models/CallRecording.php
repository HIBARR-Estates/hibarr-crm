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
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];
}
