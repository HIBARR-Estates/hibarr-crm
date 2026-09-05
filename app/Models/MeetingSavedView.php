<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetingSavedView extends BaseModel
{
    use HasCompany;

    public const VISIBILITY_PRIVATE = 'private';

    public const VISIBILITY_TEAM = 'team';

    /**
     * Filter keys `MeetingsController::index()` reads from the request, plus
     * the page's own view-shape keys. A saved view is replayed straight into
     * the meetings index query string, so unknown keys must never survive —
     * this list is the contract between the two.
     */
    private const ALLOWED_FILTER_KEYS = [
        'search',
        'meeting_type_id',
        'status',
        'location',
        'record_type',
        'host_id',
        'attendance',
        'meeting_date_range',
        'date_from',
        'date_to',
    ];

    protected $table = 'meeting_saved_views';

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
     * Keep only filter keys the meetings index actually understands.
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
