<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectSavedView extends BaseModel
{
    use HasCompany;

    public const VISIBILITY_PRIVATE = 'private';

    public const VISIBILITY_TEAM = 'team';

    /**
     * Filter keys DeveloperProjectListingQuery::apply() actually understands
     * under the v2 filter UI. A saved view is replayed straight into the
     * projects index query string, so unknown keys must never survive.
     */
    private const ALLOWED_FILTER_KEYS = [
        'search', 'sort',
        'developer_id', 'city', 'area',
        'construction_status', 'primary_category', 'title_deed_type', 'unit_types',
        'completion_start', 'completion_end',
        'min_number_of_phases', 'max_number_of_phases',
        'min_total_units', 'max_total_units',
        'min_payment_plan_duration', 'max_payment_plan_duration',
        'min_starting_price', 'max_starting_price',
        'downpayment_type', 'rental_guarantee', 'is_hidden',
        'facilities',
    ];

    protected $table = 'project_saved_views';

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
     * Keep only filter keys the v2 projects index actually understands.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public static function sanitizeFilters(array $filters): array
    {
        $allowed = array_intersect_key($filters, array_flip(self::ALLOWED_FILTER_KEYS));

        return array_filter($allowed, fn ($value) => $value !== null && $value !== '' && $value !== []);
    }
}
