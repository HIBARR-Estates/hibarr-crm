<?php

namespace App\Models;

use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Enums\CrmEventStatus;
use App\Enums\CrmEventDirection;
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
        'status',
        'direction',
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
        'status' => CrmEventStatus::class,
        'direction' => CrmEventDirection::class,
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
     * Scope to external events.
     */
    public function scopeExternal($query)
    {
        return $query->where('generation_type', CrmEventGenerationType::EXTERNAL);
    }

    /**
     * Scope to events with a specific status.
     */
    public function scopeWithStatus($query, CrmEventStatus|string $status)
    {
        $value = $status instanceof CrmEventStatus ? $status->value : $status;

        return $query->where('status', $value);
    }

    /**
     * Scope to events with a specific direction.
     */
    public function scopeWithDirection($query, CrmEventDirection|string $direction)
    {
        $value = $direction instanceof CrmEventDirection ? $direction->value : $direction;

        return $query->where('direction', $value);
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

    /**
     * The JSON-serializable shape shared by every timeline/activity surface
     * (CrmEventController's API responses, the personal dashboard's recent
     * activity panel, …). Callers that also need `causation`/`effects` add
     * those themselves — this only covers the fields every consumer wants.
     *
     * Expects `eventType.category` and `user` to already be eager-loaded;
     * this does not load them itself, to keep list endpoints from N+1ing.
     */
    public function toTimelineArray(): array
    {
        return [
            'uuid' => $this->uuid,
            'event_type' => $this->eventType ? [
                'slug' => $this->eventType->slug,
                'name' => $this->eventType->name,
                // Drives the "agent-logged vs system-recorded" distinction the
                // timeline uses to decide what may be edited/deleted.
                'is_system' => (bool) $this->eventType->is_system,
                'category' => $this->eventType->category ? [
                    'slug' => $this->eventType->category->slug,
                    'name' => $this->eventType->category->name,
                ] : null,
            ] : null,
            'generation_type' => $this->generation_type?->value ?? $this->generation_type,
            'status' => $this->status?->value ?? $this->status,
            'direction' => $this->direction?->value ?? $this->direction,
            'user_id' => $this->user_id,
            'user' => $this->relationLoaded('user') && $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
            ] : null,
            'model_type' => $this->model_type,
            'model_id' => $this->model_id,
            'correlation_id' => $this->correlation_id,
            'causation_id' => $this->causation_id,
            'source' => $this->source?->value ?? $this->source,
            'ip_address' => $this->ip_address,
            'metadata' => $this->metadata,
            'occurred_at' => $this->occurred_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
