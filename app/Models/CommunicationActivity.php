<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * App\Models\CommunicationActivity
 *
 * @property int $id
 * @property int|null $deal_id
 * @property int|null $lead_id
 * @property string $channel_type
 * @property text $message_content
 * @property json $sender_info
 * @property datetime $timestamp
 * @property json $metadata
 * @property int|null $company_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Deal|null $deal
 * @property-read \App\Models\Lead|null $lead
 * @property-read \App\Models\Company|null $company
 */
class CommunicationActivity extends Model
{
    use HasFactory, HasCompany;

    protected $fillable = [
        'deal_id',
        'lead_id',
        'parent_activity_id',
        'channel_type',
        'message_content',
        'sender_info',
        'timestamp',
        'metadata',
        'company_id',
        'email',
        'phone_number',
        'instagram_username',
        'telegram_username',
        'whatsapp_username',
        'first_name',
        'last_name',
        'message_type',
        'subject',
        'resolution_status',
        'resolution_attempts',
        'chat_id'
    ];

    protected $casts = [
        'sender_info' => 'array',
        'metadata' => 'array',
        'timestamp' => 'datetime',
    ];

    /**
     * Get the files associated with the communication activity.
     */
    public function files(): HasMany
    {
        return $this->hasMany(CommunicationActivityFile::class, 'activity_id');
    }

    /**
     * Get the deal that owns the communication activity.
     */
    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class);
    }

    /**
     * Get the lead that owns the communication activity.
     */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    /**
     * Get the parent activity if this is a reply.
     */
    public function parentActivity(): BelongsTo
    {
        return $this->belongsTo(CommunicationActivity::class, 'parent_activity_id');
    }

    /**
     * Get the children replies to this activity.
     */
    public function replies(): HasMany
    {
        return $this->hasMany(CommunicationActivity::class, 'parent_activity_id');
    }

    /**
     * Get the channel type label.
     */
    public function getChannelTypeLabelAttribute(): string
    {
        return ucfirst($this->channel_type);
    }

    /**
     * Get the sender name from sender_info.
     */
    public function getSenderNameAttribute(): string
    {
        return $this->sender_info['name'] ?? 'Unknown';
    }

    /**
     * Get the sender contact from sender_info.
     */
    public function getSenderContactAttribute(): string
    {
        return $this->sender_info['contact'] ?? '';
    }

    /**
     * Scope to filter by channel type.
     */
    public function scopeByChannel($query, $channelType)
    {
        return $query->where('channel_type', $channelType);
    }

    /**
     * Scope to filter by deal.
     */
    public function scopeByDeal($query, $dealId)
    {
        return $query->where('deal_id', $dealId);
    }

    /**
     * Scope to filter by lead.
     */
    public function scopeByLead($query, $leadId)
    {
        return $query->where('lead_id', $leadId);
    }
} 