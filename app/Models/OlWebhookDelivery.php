<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OlWebhookDelivery extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    public const STATUS_EXHAUSTED = 'exhausted';

    public const STATUS_REJECTED = 'rejected';

    public const ORIGIN_OBSERVER = 'observer';

    public const ORIGIN_BACKFILL = 'backfill';

    public const ORIGIN_RECONCILE = 'reconcile';

    protected $table = 'ol_webhook_deliveries';

    protected $fillable = [
        'crm_event_id',
        'crm_event_uuid',
        'event_type_slug',
        'model_type',
        'model_id',
        'company_id',
        'origin',
        'status',
        'attempts',
        'last_error',
        'last_attempted_at',
        'delivered_at',
    ];

    protected $casts = [
        'last_attempted_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    public function crmEvent(): BelongsTo
    {
        return $this->belongsTo(CrmEvent::class, 'crm_event_id')->withoutGlobalScopes();
    }

    public function scopeForEntity($query, string $modelType, int $modelId, string $eventTypeSlug)
    {
        return $query->where('model_type', $modelType)
            ->where('model_id', $modelId)
            ->where('event_type_slug', $eventTypeSlug);
    }
}
