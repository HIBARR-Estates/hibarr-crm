<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\LeadAssignmentPool;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Decides who a lead is handed to for the assign_lead_owner automation action: one named user, or
 * the next person in a pool. It only decides and writes the owner; the action wrapper in
 * DealAutomationService logs, records the timeline event and notifies.
 */
class LeadAssignmentService
{
    public const STRATEGY_SPECIFIC_USER = 'specific_user';

    public const STRATEGY_ROUND_ROBIN = 'round_robin';

    public const WHEN_OWNED_SKIP = 'skip';

    public const WHEN_OWNED_OVERWRITE = 'overwrite';

    public const WHEN_OWNED_OVERWRITE_IF_DEFAULT = 'overwrite_if_default_owner';

    public const OUTCOME_ASSIGNED = 'assigned';

    public const OUTCOME_SKIPPED = 'skipped';

    public const OUTCOME_FAILED = 'failed';

    /**
     * @param  array{strategy?: string, user_id?: int|string|null, pool_id?: int|string|null, when_owned?: string}  $config
     * @return array{outcome: string, user_id: ?int, previous_owner_id: ?int, reason: string, pool_id: ?int}
     */
    public function assign(Lead $lead, array $config): array
    {
        $previous = $lead->lead_owner ? (int) $lead->lead_owner : null;
        $poolId = ! empty($config['pool_id']) ? (int) $config['pool_id'] : null;
        $result = fn (string $outcome, string $reason, ?int $userId = null) => [
            'outcome' => $outcome,
            'user_id' => $userId,
            'previous_owner_id' => $previous,
            'reason' => $reason,
            'pool_id' => $poolId,
        ];

        if ($previous !== null && ! $this->mayReplaceOwner($previous, $config['when_owned'] ?? self::WHEN_OWNED_SKIP)) {
            return $result(self::OUTCOME_SKIPPED, 'The lead already has an owner');
        }

        $strategy = $config['strategy'] ?? self::STRATEGY_SPECIFIC_USER;

        return DB::transaction(function () use ($lead, $config, $strategy, $poolId, $result) {
            // The check above is a fast path on a copy that may be stale. Decide on the locked row, so
            // two entries reaching one lead together cannot both pass "skip if owned" and overwrite
            // each other.
            $current = Lead::withoutGlobalScopes()->whereKey($lead->id)->lockForUpdate()->first();
            $currentOwner = $current?->lead_owner ? (int) $current->lead_owner : null;
            if ($current === null) {
                return $result(self::OUTCOME_FAILED, 'The lead no longer exists');
            }
            if ($currentOwner !== null && ! $this->mayReplaceOwner($currentOwner, $config['when_owned'] ?? self::WHEN_OWNED_SKIP)) {
                return ['previous_owner_id' => $currentOwner] + $result(self::OUTCOME_SKIPPED, 'The lead already has an owner');
            }

            $userId = match ($strategy) {
                self::STRATEGY_ROUND_ROBIN => $poolId ? $this->nextFromPool($lead, $poolId) : null,
                default => $this->activeUserId($config['user_id'] ?? null, (int) $lead->company_id),
            };

            if ($userId === null) {
                return $result(
                    self::OUTCOME_FAILED,
                    $strategy === self::STRATEGY_ROUND_ROBIN
                        ? 'The pool has no available member'
                        : 'The chosen user is missing or inactive'
                );
            }

            $lead->lead_owner = $userId;
            $lead->assigned_at = now();
            $lead->saveQuietly();

            return ['previous_owner_id' => $currentOwner] + $result(
                self::OUTCOME_ASSIGNED,
                $strategy === self::STRATEGY_ROUND_ROBIN ? 'Next in the pool' : 'Named user',
                $userId
            );
        });
    }

    private function mayReplaceOwner(int $currentOwnerId, string $whenOwned): bool
    {
        return match ($whenOwned) {
            self::WHEN_OWNED_OVERWRITE => true,
            self::WHEN_OWNED_OVERWRITE_IF_DEFAULT => $currentOwnerId === (int) config('services.ol.default_lead_owner_id', 1),
            default => false,
        };
    }

    /**
     * The id when it names an active user of the lead's company (the User model's ActiveScope hides
     * inactive ones). The company is explicit: an intake request is token-authenticated, so no
     * request user narrows the query for us.
     */
    private function activeUserId(mixed $userId, int $companyId): ?int
    {
        if (empty($userId)) {
            return null;
        }

        return User::query()->where('company_id', $companyId)->whereKey((int) $userId)->value('id');
    }

    /**
     * The next eligible member after the pool's cursor, wrapping around. The pool row is locked for
     * the whole transaction, so two leads arriving together land on different people. Members that
     * are away, or whose user is no longer active, are skipped without losing their place.
     */
    private function nextFromPool(Lead $lead, int $poolId): ?int
    {
        $pool = LeadAssignmentPool::withoutGlobalScopes()
            ->where('company_id', $lead->company_id)
            ->whereKey($poolId)
            ->lockForUpdate()
            ->first();

        if (! $pool || ! $pool->active) {
            return null;
        }

        $members = $pool->members()->where('active', true)->get();
        if ($members->isEmpty()) {
            return null;
        }

        $activeUserIds = User::query()
            ->where('company_id', $lead->company_id)
            ->whereIn('id', $members->pluck('user_id'))
            ->pluck('id')
            ->all();
        $eligible = $members->filter(fn ($member) => in_array((int) $member->user_id, $activeUserIds, true))->values();
        if ($eligible->isEmpty()) {
            return null;
        }

        $next = $eligible->first(fn ($member) => $pool->last_member_id === null || $member->id > $pool->last_member_id)
            ?? $eligible->first();

        $pool->last_member_id = $next->id;
        $pool->save();

        return (int) $next->user_id;
    }
}
