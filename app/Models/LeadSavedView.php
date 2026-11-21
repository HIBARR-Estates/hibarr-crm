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

    /**
     * Who may rename, re-pin, overwrite the filters of, or delete a view: its
     * owner, and admins for any view shared with the team. A private view
     * stays private to its owner — admins never see it.
     */
    public function isManageableBy(int $userId, bool $isAdmin = false): bool
    {
        if ((int) $this->user_id === $userId) {
            return true;
        }

        return $isAdmin && $this->visibility === self::VISIBILITY_TEAM;
    }

    public function isOwnedBy(int $userId): bool
    {
        return (int) $this->user_id === $userId;
    }

    /**
     * Only the owner decides who a view is shared with. An admin fixing up a
     * team view may leave it as it is, but cannot take it private (that would
     * hide it from the team and from the admin).
     */
    public function canSetVisibility(int $userId, string $visibility): bool
    {
        return $visibility === $this->visibility || $this->isOwnedBy($userId);
    }

    /** Whether the signed-in user is a company admin (session-cached roles). */
    public static function viewerIsAdmin(): bool
    {
        return in_array('admin', user_roles(), true);
    }

    /**
     * The view as the Leads page and the saved-views endpoints send it.
     * `can_manage` is the one flag the UI needs; it never has to know roles.
     *
     * @return array<string, mixed>
     */
    public function presentFor(int $userId, bool $isAdmin): array
    {
        $this->loadMissing('owner:id,name');

        return [
            'id' => $this->id,
            'name' => $this->name,
            'filters' => $this->filters,
            'visibility' => $this->visibility,
            'pinned' => $this->pinned,
            'is_owner' => $this->isOwnedBy($userId),
            'can_manage' => $this->isManageableBy($userId, $isAdmin),
            'owner_name' => $this->owner?->name,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
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
