<?php

namespace App\Support;

use App\Models\Developer;
use App\Models\DeveloperProject;
use Illuminate\Database\Eloquent\Builder;

/**
 * Visibility helpers for hiding developers / projects from view-only users.
 *
 * Bypass (see + toggle hidden): users with edit/manage permission.
 * View-only: filtered out of list/show/all.
 */
class DeveloperProjectVisibility
{
    public const FLAG = 'crm.developer-project-visibility';

    public static function enabled(): bool
    {
        return FeatureFlags::enabled(self::FLAG);
    }

    /**
     * Whether the current user can see (and manage) hidden developers.
     * Prefers edit_developers; falls back to edit_developer_projects when
     * the developers permission module is not seeded.
     */
    public static function canSeeHiddenDevelopers(?object $user = null): bool
    {
        $user = $user ?? user();

        if (self::hasEditPermission($user, 'edit_developers')) {
            return true;
        }

        return self::hasEditPermission($user, 'edit_developer_projects');
    }

    public static function canSeeHiddenProjects(?object $user = null): bool
    {
        $user = $user ?? user();

        return self::hasEditPermission($user, 'edit_developer_projects');
    }

    public static function canToggleDeveloperHidden(?object $user = null): bool
    {
        return self::canSeeHiddenDevelopers($user);
    }

    public static function canToggleProjectHidden(?object $user = null): bool
    {
        return self::canSeeHiddenProjects($user);
    }

    /**
     * @param  Builder<Developer>  $query
     * @return Builder<Developer>
     */
    public static function scopeVisibleDevelopers(Builder $query, ?object $user = null): Builder
    {
        if (! self::enabled() || self::canSeeHiddenDevelopers($user)) {
            return $query;
        }

        return $query->where('is_hidden', false);
    }

    /**
     * Exclude projects that are hidden OR whose parent developer is hidden.
     *
     * @param  Builder<DeveloperProject>  $query
     * @return Builder<DeveloperProject>
     */
    public static function scopeVisibleProjects(Builder $query, ?object $user = null): Builder
    {
        if (! self::enabled() || self::canSeeHiddenProjects($user)) {
            return $query;
        }

        return $query
            ->where('is_hidden', false)
            ->where(function (Builder $q) {
                $q->whereNull('developer_id')
                    ->orWhereHas('developer', function (Builder $dq) {
                        $dq->where('is_hidden', false);
                    });
            });
    }

    /**
     * Abort with 404 if the developer is hidden from this user.
     */
    public static function assertDeveloperVisible(Developer $developer, ?object $user = null): void
    {
        if (! self::enabled()) {
            return;
        }

        if ($developer->is_hidden && ! self::canSeeHiddenDevelopers($user)) {
            abort(404);
        }
    }

    /**
     * Abort with 404 if the project (or its parent developer) is hidden from this user.
     */
    public static function assertProjectVisible(DeveloperProject $project, ?object $user = null): void
    {
        if (! self::enabled()) {
            return;
        }

        if (self::canSeeHiddenProjects($user)) {
            return;
        }

        if ($project->is_hidden) {
            abort(404);
        }

        $developer = $project->relationLoaded('developer')
            ? $project->developer
            : $project->developer()->first();

        if ($developer && $developer->is_hidden) {
            abort(404);
        }
    }

    private static function hasEditPermission(object $user, string $permission): bool
    {
        if (! method_exists($user, 'permission')) {
            return false;
        }

        $scope = $user->permission($permission);

        return is_string($scope) && in_array($scope, ['all', 'added', 'owned', 'both'], true);
    }
}
