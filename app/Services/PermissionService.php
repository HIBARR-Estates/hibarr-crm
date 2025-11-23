<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class PermissionService
{
    /**
     * Check if a user has access to a model instance based on their permission scope.
     *
     * @param User $user The user to check access for.
     * @param string $permissionName The name of the permission (e.g., 'view_deals').
     * @param Model|null $model The model instance to check.
     * @param array $rules An associative array defining the conditions for each scope.
     *                     Keys should be 'added', 'owned', or 'both'.
     *                     Values can be:
     *                     - A boolean (result of a check).
     *                     - A closure returning a boolean: fn($user, $model) => bool.
     *                     - A string (field name on the model to compare with user ID).
     *                     - An array with 'condition' (bool/closure/string) and optional 'reason' (string).
     * 
     *                     Example:
     *                     [
     *                         'added' => [
     *                             'condition' => 'added_by',
     *                             'reason' => 'You did not add this record.'
     *                         ],
     *                         'owned' => fn($u, $m) => $u->id === $m->lead_owner
     *                     ]
     * 
     * @return array ['canAccess' => bool, 'errors' => array]
     */
    public static function checkAccess(User $user, string $permissionName, ?Model $model, array $rules = []): array
    {
        $permissionScope = $user->permission($permissionName);
        $errors = [];

        // 1. 'all' - Access granted globally
        if ($permissionScope === 'all') {
            return ['canAccess' => true, 'errors' => []];
        }

        // 2. 'none' - Access denied globally
        if ($permissionScope === 'none') {
            return ['canAccess' => false, 'errors' => ['Access denied: You do not have permission to view this resource.']];
        }

        // If no model is provided but permission is restricted (added/owned/both),
        // we can't validate against a specific instance. 
        // Usually, this implies we are checking general access, which is true if not 'none'.
        if (!$model) {
            return ['canAccess' => true, 'errors' => []];
        }

        // Helper to evaluate a rule
        $evaluate = function ($scope, $rule) use ($user, $model) {
            $condition = $rule;
            $reason = "You do not have '$scope' access to this resource.";

            if (is_array($rule)) {
                $condition = $rule['condition'] ?? false;
                $reason = $rule['reason'] ?? $reason;
            }

            if (is_string($condition)) {
                // Assume it's a field name
                $result = ($model->{$condition} == $user->id);
            } elseif (is_callable($condition)) {
                $result = $condition($user, $model);
            } else {
                $result = (bool) $condition;
            }

            return ['pass' => $result, 'reason' => $reason];
        };

        // 3. 'added' - Check added rule
        if ($permissionScope === 'added') {
            if (!isset($rules['added'])) {
                // Fallback default
                $rules['added'] = 'added_by';
            }
            
            $eval = $evaluate('added', $rules['added']);
            if ($eval['pass']) {
                return ['canAccess' => true, 'errors' => []];
            }
            $errors[] = $eval['reason'];
        }

        // 4. 'owned' - Check owned rule
        if ($permissionScope === 'owned') {
            if (!isset($rules['owned'])) {
                // Fallback default
                $rules['owned'] = 'user_id'; // Common default, but often needs override
            }

            $eval = $evaluate('owned', $rules['owned']);
            if ($eval['pass']) {
                return ['canAccess' => true, 'errors' => []];
            }
            $errors[] = $eval['reason'];
        }

        // 5. 'both' - Check added OR owned
        if ($permissionScope === 'both') {
            // Ensure rules exist
            $addedRule = $rules['added'] ?? 'added_by';
            $ownedRule = $rules['owned'] ?? ($rules['owned'] ?? 'user_id');

            $addedEval = $evaluate('added', $addedRule);
            if ($addedEval['pass']) {
                return ['canAccess' => true, 'errors' => []];
            }

            $ownedEval = $evaluate('owned', $ownedRule);
            if ($ownedEval['pass']) {
                return ['canAccess' => true, 'errors' => []];
            }

            $errors[] = $addedEval['reason'];
            $errors[] = $ownedEval['reason'];
        }

        return ['canAccess' => false, 'errors' => array_unique($errors)];
    }

    /**
     * Apply permission scope to a query builder.
     * 
     * @param Builder $query
     * @param User $user
     * @param string $permissionName
     * @param array $rules ['added' => 'added_by', 'owned' => 'lead_owner'] or closures
     * @return Builder
     */
    public static function applyScope(Builder $query, User $user, string $permissionName, array $rules = []): Builder
    {
        $permissionScope = $user->permission($permissionName);

        if ($permissionScope === 'all') {
            return $query;
        }

        if ($permissionScope === 'none') {
            // Return empty result
            return $query->whereRaw('1 = 0');
        }

        $applyRule = function($q, $rule) use ($user) {
            if (is_string($rule)) {
                $q->where($rule, $user->id);
            } elseif (is_callable($rule)) {
                $rule($q, $user);
            }
        };

        $addedRule = $rules['added'] ?? 'added_by';
        $ownedRule = $rules['owned'] ?? 'user_id';

        if ($permissionScope === 'added') {
            $applyRule($query, $addedRule);
        } elseif ($permissionScope === 'owned') {
            $applyRule($query, $ownedRule);
        } elseif ($permissionScope === 'both') {
            $query->where(function($q) use ($applyRule, $addedRule, $ownedRule) {
                $q->where(function($subQ) use ($applyRule, $addedRule) {
                    $applyRule($subQ, $addedRule);
                })->orWhere(function($subQ) use ($applyRule, $ownedRule) {
                    $applyRule($subQ, $ownedRule);
                });
            });
        }

        return $query;
    }
}
