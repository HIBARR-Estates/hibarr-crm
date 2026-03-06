<?php

namespace App\Models;

use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use Illuminate\Database\Eloquent\Model;

/**
 * Archive table for CRM events. Mirrors CrmEvent schema but without FK constraints.
 * Used for cold storage of events that have been archived by the retention policy.
 */
class CrmEventArchive extends Model
{
    protected $table = 'crm_events_archive';

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
        'archived_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'occurred_at' => 'datetime',
        'archived_at' => 'datetime',
        'generation_type' => CrmEventGenerationType::class,
        'source' => CrmEventSource::class,
    ];

    // ─── Scopes ──────────────────────────────────────────────────

    /**
     * Scope to archived events for a specific company.
     */
    public function scopeForCompany($query, int $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    /**
     * Scope to archived events within a correlation chain.
     */
    public function scopeForCorrelation($query, string $correlationId)
    {
        return $query->where('correlation_id', $correlationId);
    }

    /**
     * Scope to archived events for a specific polymorphic model.
     */
    public function scopeForModel($query, string $modelType, int $modelId)
    {
        return $query->where('model_type', $modelType)->where('model_id', $modelId);
    }
}
