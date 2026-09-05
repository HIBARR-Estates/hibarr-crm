<?php

namespace App\Observers;

use App\Models\AgentMetric;
use App\Models\LeadAgent;
use App\Services\CycleService;
use App\Services\HierarchyService;
use App\Services\LevelService;
use App\Services\MlmNotificationService;

class LeadAgentObserver
{
    public function __construct(
        protected LevelService $levelService,
        protected CycleService $cycleService,
        protected MlmNotificationService $mlmNotifications,
    ) {
    }

    public function saving(LeadAgent $leadAgent)
    {
        if (!isRunningInConsoleOrSeeding()) {
            $currentUserId = auth()->id();
            if ($currentUserId) {
                $leadAgent->last_updated_by = $currentUserId;
            }
        }
    }

    public function creating(LeadAgent $leadAgent)
    {
        if (!isRunningInConsoleOrSeeding()) {
            $currentUserId = auth()->id();
            if ($currentUserId) {
                $leadAgent->added_by = $currentUserId;
            }
        }

        if (empty($leadAgent->company_id)) {
            $currentUser = auth()->user();
            if ($currentUser && !empty($currentUser->company_id)) {
                $leadAgent->company_id = $currentUser->company_id;
            }
        }
    }

    /**
     * After a new agent is created, assign the base MLM level, enroll in the active cycle,
     * and ensure an AgentMetric row exists.
     */
    public function created(LeadAgent $leadAgent): void
    {
        $this->levelService->assignBaseLevel($leadAgent);
        $this->cycleService->ensureEnrollment($leadAgent);

        AgentMetric::firstOrCreate(
            ['agent_id' => $leadAgent->id],
            [
                'company_id' => $leadAgent->company_id,
                'nsa' => 0,
                'nsd' => 0,
                'vsa' => 0,
                'vsd' => 0,
            ]
        );

        if (! isRunningInConsoleOrSeeding()) {
            $this->mlmNotifications->afterCommit(function () use ($leadAgent) {
                $fresh = $leadAgent->fresh(['user', 'parentAgent.user']);
                if (! $fresh) {
                    return;
                }

                $this->mlmNotifications->notifyPartnerNetworkJoined($fresh, user()?->id);

                if ($fresh->parent_agent_id && $fresh->parentAgent) {
                    $this->mlmNotifications->notifyNewRecruitAdded(
                        $fresh,
                        $fresh->parentAgent,
                        user()?->id,
                    );
                }
            });
        }
    }

    /**
     * Keep the agent_hierarchy closure table in step with parent_agent_id.
     *
     * parent_agent_id is the foreign key; agent_hierarchy is what the
     * commission engine actually reads to find an agent's uplines. Only
     * MlmAdminApiController::assignDownline() went through
     * HierarchyService::setParent() and maintained both — the employee sync
     * API (and anything else assigning an upline) wrote the FK directly, so
     * those agents had a parent the engine could not see and their uplines
     * silently earned nothing on every deal.
     *
     * Placed on the model rather than fixed at that one caller so every
     * writer is covered, including future ones. HierarchyService itself uses
     * saveQuietly(), so this never re-enters.
     */
    public function saved(LeadAgent $leadAgent): void
    {
        // On create the attribute was set, not "changed", so the two cases
        // have to be asked about differently.
        $parentTouched = $leadAgent->wasRecentlyCreated
            ? $leadAgent->parent_agent_id !== null
            : $leadAgent->wasChanged('parent_agent_id');

        if (! $parentTouched) {
            return;
        }

        // An agent parented to itself has no meaningful closure and would
        // corrupt every ancestor query that reads one.
        if ((int) $leadAgent->parent_agent_id === (int) $leadAgent->id) {
            return;
        }

        $hierarchy = app(HierarchyService::class);

        if ($leadAgent->parent_agent_id === null) {
            $hierarchy->removeParent($leadAgent);

            return;
        }

        $parent = LeadAgent::find($leadAgent->parent_agent_id);

        if ($parent) {
            $hierarchy->setParent($leadAgent, $parent);
        }
    }
}
