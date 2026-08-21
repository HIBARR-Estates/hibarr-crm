<?php

namespace App\Observers;

use App\Models\AgentMetric;
use App\Models\LeadAgent;
use App\Services\CycleService;
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
}
