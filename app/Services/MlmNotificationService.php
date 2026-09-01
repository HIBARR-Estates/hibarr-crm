<?php

namespace App\Services;

use App\Enums\MlmNotificationEvent;
use App\Models\AgentCycleEnrollment;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmCommissionDispute;
use App\Models\MlmCycle;
use App\Models\MlmLevel;
use App\Models\Permission;
use App\Models\PermissionType;
use App\Models\User;
use App\Models\UserPermission;
use App\Notifications\BaseNotification;
use App\Notifications\MlmEventNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class MlmNotificationService
{
    public function __construct(
        protected HierarchyService $hierarchyService,
        protected LevelService $levelService,
    ) {
    }

    /**
     * @param  Collection<int, User>|array<int, User>  $recipients
     * @param  array<string, mixed>  $context
     */
    public function notify(
        MlmNotificationEvent $event,
        int $companyId,
        Collection|array $recipients,
        array $context = [],
        ?int $triggeredByUserId = null,
    ): void {
        $users = $recipients instanceof Collection ? $recipients : collect($recipients);
        $users = $users->filter(fn ($user) => $user instanceof User && ! empty($user->email))->unique('id');

        if ($users->isEmpty()) {
            return;
        }

        $notification = new MlmEventNotification($event, $companyId, $context, $triggeredByUserId);
        Notification::send($users, BaseNotification::applySuppressionFromContainer($notification));
    }

    public function notifyCommissionEarned(MlmCommission $commission, ?int $triggeredByUserId = null): void
    {
        $commission->loadMissing(['deal', 'agent.user', 'level']);
        $agentUser = $this->agentUser($commission->agent);

        if (! $agentUser) {
            return;
        }

        $this->notify(
            MlmNotificationEvent::CommissionEarned,
            (int) $commission->company_id,
            collect([$agentUser]),
            $this->commissionContext($commission),
            $triggeredByUserId,
        );
    }

    public function notifyCommissionPaid(MlmCommission $commission, ?int $triggeredByUserId = null): void
    {
        $commission->loadMissing(['deal', 'agent.user', 'level']);
        $agentUser = $this->agentUser($commission->agent);

        if (! $agentUser) {
            return;
        }

        $this->notify(
            MlmNotificationEvent::CommissionPaid,
            (int) $commission->company_id,
            collect([$agentUser]),
            $this->commissionContext($commission),
            $triggeredByUserId,
        );
    }

    public function notifyCommissionClawback(MlmCommission $commission, string $reason, ?int $triggeredByUserId = null): void
    {
        $commission->loadMissing(['deal', 'agent.user', 'level']);
        $agentUser = $this->agentUser($commission->agent);

        if (! $agentUser) {
            return;
        }

        $context = $this->commissionContext($commission);
        $context['reason'] = $reason;

        $this->notify(
            MlmNotificationEvent::CommissionClawback,
            (int) $commission->company_id,
            collect([$agentUser]),
            $context,
            $triggeredByUserId,
        );
    }

    public function notifyCommissionDisputed(MlmCommissionDispute $dispute, ?int $triggeredByUserId = null): void
    {
        $dispute->loadMissing(['commission.deal', 'commission.level', 'agent.user']);
        $commission = $dispute->commission;

        $recipients = collect([$this->agentUser($dispute->agent)])
            ->merge(User::allAdmins((int) $dispute->company_id))
            ->filter()
            ->unique('id');
        // TODO: also notify partner-network managers (manage_partner_network = all).

        $context = $commission
            ? $this->commissionContext($commission)
            : ['amount' => '', 'deal_name' => ''];
        $context['dispute_reason'] = $dispute->reason;
        $context['dispute_message'] = $dispute->message;

        $this->notify(
            MlmNotificationEvent::CommissionDisputed,
            (int) $dispute->company_id,
            $recipients,
            $context,
            $triggeredByUserId,
        );
    }

    public function notifyLevelChange(
        LeadAgent $agent,
        ?MlmLevel $previousLevel,
        MlmLevel $newLevel,
        ?int $triggeredByUserId = null,
    ): void {
        $previousRank = $previousLevel?->rank ?? -1;
        $newRank = $newLevel->rank;

        if ($newRank === $previousRank) {
            return;
        }

        $agent->loadMissing('user');
        $context = [
            'agent_name' => $agent->user?->name ?? __('app.agent'),
            'previous_level_name' => $previousLevel?->name ?? __('email.mlm.base_level'),
            'level_name' => $newLevel->name,
        ];

        $agentUser = $this->agentUser($agent);

        if (! $agentUser) {
            return;
        }

        // TODO: also notify the agent's upline on level upgrade (not downgrade).
        $this->notify(
            $newRank > $previousRank
                ? MlmNotificationEvent::AgentLevelUpgraded
                : MlmNotificationEvent::AgentLevelDowngraded,
            (int) $agent->company_id,
            collect([$agentUser]),
            $context,
            $triggeredByUserId,
        );
    }

    public function notifyLevelCriteriaApproaching(
        LeadAgent $agent,
        MlmLevel $targetLevel,
        int $progressPercent,
    ): void {
        $agent->loadMissing('user');
        $agentUser = $this->agentUser($agent);

        if (! $agentUser) {
            return;
        }

        $this->notify(
            MlmNotificationEvent::AgentLevelCriteriaApproaching,
            (int) $agent->company_id,
            collect([$agentUser]),
            [
                'agent_name' => $agent->user?->name ?? __('app.agent'),
                'level_name' => $targetLevel->name,
                'progress_percent' => $progressPercent,
            ],
        );
    }

    public function notifyCommissionProfileChanged(
        LeadAgent $agent,
        ?float $previousRate,
        ?float $newRate,
        ?string $reason = null,
        ?int $triggeredByUserId = null,
    ): void {
        $agent->loadMissing('user');
        $agentUser = $this->agentUser($agent);

        if (! $agentUser) {
            return;
        }

        $this->notify(
            MlmNotificationEvent::AgentCommissionProfileChanged,
            (int) $agent->company_id,
            collect([$agentUser]),
            [
                'agent_name' => $agent->user?->name ?? __('app.agent'),
                'previous_rate' => $previousRate !== null ? number_format($previousRate, 2).'%' : __('email.mlm.default_rate'),
                'new_rate' => $newRate !== null ? number_format($newRate, 2).'%' : __('email.mlm.default_rate'),
                'reason' => $reason,
            ],
            $triggeredByUserId,
        );
    }

    public function notifyCycleStarted(MlmCycle $cycle, ?int $triggeredByUserId = null): void
    {
        $recipients = $this->allActiveAgentUsers((int) $cycle->company_id);

        $this->notify(
            MlmNotificationEvent::CycleStarted,
            (int) $cycle->company_id,
            $recipients,
            $this->cycleContext($cycle),
            $triggeredByUserId,
        );
    }

    public function notifyCycleCompleted(MlmCycle $cycle, ?int $triggeredByUserId = null): void
    {
        $recipients = $this->allActiveAgentUsers((int) $cycle->company_id)
            ->merge(User::allAdmins((int) $cycle->company_id))
            ->unique('id');

        $this->notify(
            MlmNotificationEvent::CycleCompleted,
            (int) $cycle->company_id,
            $recipients,
            $this->cycleContext($cycle),
            $triggeredByUserId,
        );
    }

    public function notifyCycleCriteriaMet(
        LeadAgent $agent,
        MlmCycle $cycle,
        ?MlmLevel $levelAchieved = null,
    ): void {
        $agent->loadMissing('user');
        $agentUser = $this->agentUser($agent);

        if (! $agentUser) {
            return;
        }

        $context = $this->cycleContext($cycle);
        $context['level_name'] = $levelAchieved?->name;

        $this->notify(
            MlmNotificationEvent::CycleCriteriaMet,
            (int) $agent->company_id,
            collect([$agentUser]),
            $context,
        );
    }

    public function notifyCycleDeadlineApproaching(
        LeadAgent $agent,
        AgentCycleEnrollment $enrollment,
        int $daysRemaining,
    ): void {
        $enrollment->loadMissing('cycle');
        $agent->loadMissing('user');
        $agentUser = $this->agentUser($agent);

        if (! $agentUser || ! $enrollment->cycle) {
            return;
        }

        $context = $this->cycleContext($enrollment->cycle);
        $context['days_remaining'] = $daysRemaining;

        $this->notify(
            MlmNotificationEvent::CycleDeadlineApproaching,
            (int) $agent->company_id,
            collect([$agentUser]),
            $context,
        );
    }

    public function notifyReferralCodeUsed(Lead $lead, LeadAgent $referringAgent, ?int $triggeredByUserId = null): void
    {
        $lead->loadMissing('contact');
        $referringAgent->loadMissing('user');
        $agentUser = $this->agentUser($referringAgent);

        if (! $agentUser) {
            return;
        }

        $this->notify(
            MlmNotificationEvent::ReferralCodeUsed,
            (int) $lead->company_id,
            collect([$agentUser]),
            [
                'lead_name' => $lead->client_name ?? $lead->contact?->client_name ?? __('modules.lead.lead'),
                'lead_id' => $lead->id,
            ],
            $triggeredByUserId,
        );
    }

    public function notifyNewRecruitAdded(LeadAgent $recruit, LeadAgent $upline, ?int $triggeredByUserId = null): void
    {
        $recruit->loadMissing('user');
        $upline->loadMissing('user');

        $recipients = User::allAdmins((int) $recruit->company_id);

        $this->notify(
            MlmNotificationEvent::NewRecruitAdded,
            (int) $recruit->company_id,
            $recipients,
            [
                'recruit_name' => $recruit->user?->name ?? __('app.agent'),
                'upline_name' => $upline->user?->name ?? __('app.agent'),
            ],
            $triggeredByUserId,
        );
    }

    public function notifyPartnerNetworkJoined(LeadAgent $agent, ?int $triggeredByUserId = null): void
    {
        $agent->loadMissing('user');
        $agentUser = $this->agentUser($agent);

        $recipients = collect([$agentUser])
            ->merge(User::allAdmins((int) $agent->company_id))
            ->filter()
            ->unique('id');

        $this->notify(
            MlmNotificationEvent::PartnerNetworkJoined,
            (int) $agent->company_id,
            $recipients,
            [
                'agent_name' => $agent->user?->name ?? __('app.agent'),
            ],
            $triggeredByUserId,
        );
    }

    public function notifyReferralConvertedToDeal(Lead $lead, $deal, ?int $triggeredByUserId = null): void
    {
        $lead->loadMissing('referredByAgent.user');
        $referringAgent = $lead->referredByAgent;

        if (! $referringAgent) {
            return;
        }

        $agentUser = $this->agentUser($referringAgent);

        if (! $agentUser) {
            return;
        }

        $dealName = is_object($deal) ? ($deal->name ?? '') : '';

        $this->notify(
            MlmNotificationEvent::ReferralConvertedToDeal,
            (int) $lead->company_id,
            collect([$agentUser]),
            [
                'lead_name' => $lead->client_name ?? __('modules.lead.lead'),
                'deal_name' => $dealName,
                'deal_id' => is_object($deal) ? $deal->id : null,
            ],
            $triggeredByUserId,
        );
    }

    /**
     * @return array<string, mixed>
     */
    protected function commissionContext(MlmCommission $commission): array
    {
        $commission->loadMissing(['deal.currency', 'level', 'company.currency']);

        $currency = $commission->deal?->currency ?? $commission->company?->currency;
        $symbol = $currency?->currency_symbol ?? '';
        $code = $currency?->currency_code ?? '';
        $amountFormatted = number_format((float) $commission->amount, 2);
        $amountDisplay = $symbol !== ''
            ? $symbol.$amountFormatted
            : ($code !== '' ? $code.' '.$amountFormatted : $amountFormatted);

        return [
            'commission_id' => $commission->id,
            'amount' => $amountDisplay,
            'currency_code' => $code,
            'currency_symbol' => $symbol,
            'percentage' => number_format((float) $commission->percentage, 2),
            'deal_name' => $commission->deal?->name ?? '',
            'deal_id' => $commission->deal_id,
            'level_name' => $commission->level?->name,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function cycleContext(MlmCycle $cycle): array
    {
        return [
            'cycle_id' => $cycle->id,
            'cycle_name' => $cycle->name ?? ('Cycle #'.$cycle->cycle_number),
            'cycle_number' => $cycle->cycle_number,
            'start_date' => $cycle->start_date?->format('Y-m-d'),
            'end_date' => $cycle->end_date?->format('Y-m-d'),
        ];
    }

    protected function agentUser(?LeadAgent $agent): ?User
    {
        if (! $agent) {
            return null;
        }

        $agent->loadMissing('user');

        return $agent->user;
    }

    /**
     * @return Collection<int, User>
     */
    public function uplineUsers(LeadAgent $agent): Collection
    {
        return $this->hierarchyService->getAncestors($agent)
            ->load('user')
            ->pluck('user')
            ->filter()
            ->unique('id');
    }

    /**
     * @return Collection<int, User>
     */
    public function partnerNetworkManagers(int $companyId): Collection
    {
        $permissionId = Permission::query()->where('name', 'manage_partner_network')->value('id');

        if (! $permissionId) {
            return collect();
        }

        $userIds = UserPermission::query()
            ->where('permission_id', $permissionId)
            ->where('permission_type_id', PermissionType::ALL)
            ->pluck('user_id');

        return User::query()
            ->where('company_id', $companyId)
            ->whereIn('id', $userIds)
            ->get();
    }

    /**
     * @return Collection<int, User>
     */
    public function allActiveAgentUsers(int $companyId): Collection
    {
        return LeadAgent::query()
            ->where('company_id', $companyId)
            ->where('status', 'enabled')
            ->whereHas('user', fn ($q) => $q->where('users.status', 'active'))
            ->with('user')
            ->get()
            ->pluck('user')
            ->filter()
            ->unique('id');
    }

    /**
     * Queue notifications after the current DB transaction commits.
     */
    public function afterCommit(callable $callback): void
    {
        if (DB::transactionLevel() > 0) {
            DB::afterCommit($callback);

            return;
        }

        $callback();
    }
}
