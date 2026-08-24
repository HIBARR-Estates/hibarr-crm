<?php

namespace App\Models;

use App\Scopes\ActiveScope;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use App\Models\LeadCategory;

/**
 * App\Models\LeadAgent
 *
 * @property int $id
 * @property int $user_id
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null $added_by
 * @property int|null $last_updated_by
 * @property-read mixed $icon
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder|LeadAgent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|LeadAgent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|LeadAgent query()
 * @method static \Illuminate\Database\Eloquent\Builder|LeadAgent whereAddedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadAgent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadAgent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadAgent whereLastUpdatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadAgent whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadAgent whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadAgent whereUserId($value)
 * @property int|null $company_id
 * @property-read \App\Models\Company|null $company
 * @method static \Illuminate\Database\Eloquent\Builder|LeadAgent whereCompanyId($value)
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Lead> $leads
 * @property-read int|null $leads_count
 * @mixin \Eloquent
 */
class LeadAgent extends BaseModel
{

    use HasCompany;

    protected $table = 'lead_agents';
    protected $guarded = ['id'];
    protected $casts = ['is_partner' => 'boolean'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withoutGlobalScope(ActiveScope::class);
    }

    public function leads(): HasMany
    {
        return $this->hasMany(Deal::class, 'agent_id');
    }

    /**
     * Leads this agent (as a partner) referred in — see referred_by_agent_id.
     */
    public function referredLeads(): HasMany
    {
        return $this->hasMany(Lead::class, 'referred_by_agent_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(LeadCategory::class, 'lead_category_id');
    }

    // ── MLM Hierarchy ────────────────────────────────────────────

    /**
     * Direct parent agent (source of truth for hierarchy).
     */
    public function parentAgent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'parent_agent_id');
    }

    /**
     * Direct children agents.
     */
    public function childAgents(): HasMany
    {
        return $this->hasMany(LeadAgent::class, 'parent_agent_id');
    }

    /**
     * All descendants via the closure table.
     */
    public function descendantLinks(): HasMany
    {
        return $this->hasMany(AgentHierarchy::class, 'ancestor_id')->orderBy('depth');
    }

    /**
     * All ancestors via the closure table.
     */
    public function ancestorLinks(): HasMany
    {
        return $this->hasMany(AgentHierarchy::class, 'descendant_id')->orderBy('depth');
    }

    // ── MLM Metrics & Levels ─────────────────────────────────────

    /**
     * Precomputed agent metrics.
     */
    public function metrics(): HasOne
    {
        return $this->hasOne(AgentMetric::class, 'agent_id');
    }

    /**
     * Full level assignment history.
     */
    public function levelHistory(): HasMany
    {
        return $this->hasMany(AgentLevelHistory::class, 'agent_id')->orderByDesc('assigned_at');
    }

    /**
     * Most recent level assignment.
     */
    public function currentLevelHistory(): HasOne
    {
        return $this->hasOne(AgentLevelHistory::class, 'agent_id')->latestOfMany('assigned_at');
    }

    /**
     * Get the agent's current MLM level model.
     */
    public function getCurrentLevelAttribute(): ?MlmLevel
    {
        return $this->currentLevelHistory?->level;
    }

    // ── MLM Commissions ──────────────────────────────────────────

    /**
     * Commissions received by this agent.
     */
    public function mlmCommissions(): HasMany
    {
        return $this->hasMany(MlmCommission::class, 'agent_id');
    }

    /**
     * Commissions generated from deals this agent closed.
     */
    public function mlmCommissionsAsSource(): HasMany
    {
        return $this->hasMany(MlmCommission::class, 'source_agent_id');
    }

    // ── MLM Cycle Enrollments ────────────────────────────────────

    /**
     * All cycle enrollments for this agent.
     */
    public function cycleEnrollments(): HasMany
    {
        return $this->hasMany(AgentCycleEnrollment::class, 'agent_id');
    }

    /**
     * The agent's current active/extended enrollment (the one receiving metrics).
     */
    public function activeEnrollment(): HasOne
    {
        return $this->hasOne(AgentCycleEnrollment::class, 'agent_id')
            ->whereIn('status', [
                \App\Enums\EnrollmentStatus::Active,
                \App\Enums\EnrollmentStatus::Extended,
            ])
            ->latestOfMany('effective_start_date');
    }

    /**
     * All cycle metrics for this agent across enrollments.
     */
    public function cycleMetrics(): HasMany
    {
        return $this->hasMany(AgentCycleMetric::class, 'agent_id');
    }

    public function commissionRateAuditLogs(): HasMany
    {
        return $this->hasMany(AgentCommissionRateAuditLog::class, 'agent_id')->orderByDesc('changed_at');
    }
}
