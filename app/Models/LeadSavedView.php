<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadSavedView extends BaseModel
{
    use HasCompany;

    public const VISIBILITY_PRIVATE = 'private';

    public const VISIBILITY_TEAM = 'team';

    protected $table = 'lead_saved_views';

    protected $fillable = [
        'company_id',
        'user_id',
        'name',
        'filters',
        'visibility',
        'pinned',
    ];

    protected $casts = [
        'filters' => 'array',
        'pinned' => 'boolean',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Views the given user may open: their own, plus anything shared with the team.
     */
    public function scopeVisibleTo(Builder $query, int $userId): Builder
    {
        return $query->where(function (Builder $q) use ($userId) {
            $q->where('user_id', $userId)
                ->orWhere('visibility', self::VISIBILITY_TEAM);
        });
    }

    /** Only the owner may rename, re-share, or delete a view. */
    public function isEditableBy(int $userId): bool
    {
        return (int) $this->user_id === $userId;
    }

    /**
     * Keep only filter keys LeadService::applyFilters actually understands.
     * A saved view is replayed straight into the leads index query string, so
     * unknown keys must never survive — otherwise a view could smuggle
     * arbitrary params (per_page, sort_by, …) back into the request.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public static function sanitizeFilters(array $filters): array
    {
        return \App\Services\LeadService::sanitizeFilterPayload($filters);
    }
}
