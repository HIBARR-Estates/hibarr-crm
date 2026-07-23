<?php

namespace App\Services;

use App\Models\LeadAgent;

class DealAgentAssignmentService
{
    /**
     * Resolve the deal agent (lead_agents.id) for a new deal.
     *
     * Priority: explicit override → lead owner → deal creator → null (round-robin fallback).
     * Does not create LeadAgent rows.
     */
    public function resolveAgentId(
        ?int $explicitAgentId,
        ?int $leadOwnerUserId,
        ?int $actorUserId,
        ?int $categoryId = null
    ): ?int {
        if ($explicitAgentId) {
            $explicit = $this->findExplicitAgentId($explicitAgentId);

            if ($explicit) {
                return $explicit;
            }
        }

        if ($leadOwnerUserId) {
            $ownerAgentId = $this->findLeadAgentIdForUser($leadOwnerUserId, $categoryId);

            if ($ownerAgentId) {
                return $ownerAgentId;
            }
        }

        if ($actorUserId) {
            return $this->findLeadAgentIdForUser($actorUserId, $categoryId);
        }

        return null;
    }

    /**
     * Map a user to an enabled LeadAgent id. Prefers a category match when provided.
     */
    public function findLeadAgentIdForUser(int $userId, ?int $categoryId = null): ?int
    {
        $agents = LeadAgent::query()
            ->where('user_id', $userId)
            ->where('status', 'enabled')
            ->get(['id', 'lead_category_id']);

        if ($agents->isEmpty()) {
            return null;
        }

        if ($categoryId) {
            $categoryMatch = $agents->firstWhere('lead_category_id', $categoryId);

            if ($categoryMatch) {
                return (int) $categoryMatch->id;
            }
        }

        return (int) $agents->first()->id;
    }

    /**
     * Validate an explicit lead_agents.id override.
     */
    protected function findExplicitAgentId(int $explicitAgentId): ?int
    {
        $explicit = LeadAgent::query()->whereKey($explicitAgentId)->value('id');

        return $explicit ? (int) $explicit : null;
    }
}
