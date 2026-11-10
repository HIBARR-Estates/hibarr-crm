<?php

namespace App\Services\AgentWorkspace;

use App\Models\Deal;
use App\Models\User;
use App\Services\PermissionService;

/**
 * The deals on one person (lead) that a viewer may open, for the agent
 * workspace's contact page: its second row lists them, and a lead with any
 * of them opens on a deal rather than in the lead state.
 */
class ContactDeals
{
    /**
     * Open deals first, then won or lost ones; newest first within each.
     *
     * @return list<array{id: int, name: string|null, stage: string|null, stage_color: string|null, pipeline: string|null, outcome: string|null}>
     */
    public function forLead(int $leadId, User $viewer): array
    {
        return Deal::query()
            ->where('lead_id', $leadId)
            ->with(['leadStage:id,name,label_color', 'pipeline:id,name'])
            ->orderByRaw('outcome_status IS NOT NULL')
            ->orderByDesc('id')
            ->get()
            ->filter(fn (Deal $deal) => self::canView($viewer, $deal))
            ->map(fn (Deal $deal) => [
                'id' => (int) $deal->id,
                'name' => $deal->name,
                'stage' => $deal->leadStage?->name,
                'stage_color' => $deal->leadStage?->label_color,
                'pipeline' => $deal->pipeline?->name,
                'outcome' => $deal->outcome_status?->value,
            ])
            ->values()
            ->all();
    }

    /** The deal page's own view check (DealController::show). */
    public static function canView(User $viewer, Deal $deal): bool
    {
        return PermissionService::checkAccess($viewer, 'view_deals', $deal, [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ])['canAccess'];
    }
}
