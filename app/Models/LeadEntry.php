<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * One time a lead came in through a channel, as recorded by the backend (OL) and delivered with the
 * contact or deal request. A read model: the channel columns are a snapshot, never edited.
 */
class LeadEntry extends BaseModel
{
    use HasCompany;

    protected $table = 'lead_entries';

    protected $guarded = ['id'];

    protected $casts = [
        'channel_ancestor_uuids' => 'array',
        'channel_tags' => 'array',
        'sla' => 'array',
        'payload' => 'array',
        'is_new_lead' => 'boolean',
        'occurred_at' => 'datetime',
    ];

    public function contactSla(): HasOne
    {
        return $this->hasOne(LeadContactSla::class, 'lead_entry_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    /** The channel itself plus every ancestor, root first: what a channel scope is matched against. */
    public function channelLineage(): array
    {
        return array_values(array_unique([
            ...(array) $this->channel_ancestor_uuids,
            (string) $this->channel_uuid,
        ]));
    }
}
