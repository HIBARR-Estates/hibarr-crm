<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class CrmEventRetentionPolicy extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'crm_event_retention_policies';

    protected $fillable = [
        'company_id',
        'max_age_days',
        'max_row_count',
        'archive_storage',
        'archive_table',
        'is_active',
        'last_archived_at',
    ];

    protected $casts = [
        'max_age_days' => 'integer',
        'max_row_count' => 'integer',
        'is_active' => 'boolean',
        'last_archived_at' => 'datetime',
    ];

    // ─── Scopes ──────────────────────────────────────────────────

    /**
     * Scope to only active retention policies.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
