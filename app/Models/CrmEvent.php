<?php

namespace App\Models;

use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class CrmEvent extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'crm_events';

    protected $fillable = [
        'uuid',
        'company_id',
        'event_type_id',
        'generation_type',
        'user_id',
        'model_type',
        'model_id',
        'correlation_id',
        'causation_id',
        'source',
        'ip_address',
        'user_agent',
        'metadata',
        'occurred_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'occurred_at' => 'datetime',
        'generation_type' => CrmEventGenerationType::class,
        'source' => CrmEventSource::class,
    ];

    // ─── Relationships ───────────────────────────────────────────

    /**
     * Get the event type definition for this event.
     */
    public function eventType(): BelongsTo
    {
        return $this->belongsTo(CrmEventType::class, 'event_type_id');
    }

    /**
     * Get the user who initiated this event.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get the polymorphic model associated with this event.
     */
    public function model(): MorphTo
    {
        return $this->morphTo('model', 'model_type', 'model_id');
    }

    /**
     * Get the direct parent (cause) event.
     */
    public function causation(): BelongsTo
    {
        return $this->belongsTo(self::class, 'causation_id');
    }

    /**
     * Get all events directly caused by this event.
     */
    public function effects(): HasMany
    {
        return $this->hasMany(self::class, 'causation_id');
    }

    // ─── Scopes ──────────────────────────────────────────────────

    /**
     * Scope to events within a specific correlation chain.
     */
    public function scopeForCorrelation($query, string $correlationId)
    {
        return $query->where('correlation_id', $correlationId);
    }

    /**
     * Scope to events for a specific polymorphic model.
     */
    public function scopeForModel($query, string $modelType, int $modelId)
    {
        return $query->where('model_type', $modelType)->where('model_id', $modelId);
    }

    /**
     * Scope to user-generated events.
     */
    public function scopeUserGenerated($query)
    {
        return $query->where('generation_type', CrmEventGenerationType::USER_GENERATED);
    }

    /**
     * Scope to system-generated events.
     */
    public function scopeSystemGenerated($query)
    {
        return $query->where('generation_type', CrmEventGenerationType::SYSTEM_GENERATED);
    }

    /**
     * Scope to events from a specific source.
     */
    public function scopeBySource($query, CrmEventSource|string $source)
    {
        $value = $source instanceof CrmEventSource ? $source->value : $source;

        return $query->where('source', $value);
    }

    /**
     * Scope to events within a date range.
     */
    public function scopeBetween($query, $from, $to)
    {
        return $query->whereBetween('occurred_at', [$from, $to]);
    }

    /**
     * Scope to events for a specific event type slug.
     */
    public function scopeOfType($query, string $slug)
    {
        return $query->whereHas('eventType', fn ($q) => $q->where('slug', $slug));
    }
}
