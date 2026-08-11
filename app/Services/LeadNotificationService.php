<?php

namespace App\Services;

use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\User;
use App\Notifications\LeadDeleted;
use App\Notifications\LeadFollowUpOverdue;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

class LeadNotificationService
{
    /**
     * Notify the assigned lead owner when a lead is removed from the pipeline.
     */
    public function notifyLeadDeleted(Lead $lead, ?User $deletedBy = null): void
    {
        if (! $lead->relationLoaded('leadOwner') || ! $lead->relationLoaded('company')) {
            $lead->loadMissing(['leadOwner', 'company']);
        }

        $recipients = collect();
        $owner = $lead->leadOwner;
        if ($owner && (int) $owner->id !== (int) ($deletedBy?->id)) {
            $recipients->push($owner);
        }

        if ($recipients->isEmpty() && $lead->company_id) {
            $recipients = User::allAdmins((int) $lead->company_id)
                ->filter(fn (User $user) => $user->status === 'active' && (int) $user->id !== (int) ($deletedBy?->id))
                ->values();
        }

        if ($recipients->isEmpty()) {
            return;
        }

        Notification::send($recipients, new LeadDeleted($lead, $deletedBy));
    }

    /**
     * Notify assigned agent and their manager when a follow-up date has passed.
     */
    public function notifyFollowUpOverdue(DealFollowUp $followUp): void
    {
        $followUp->loadMissing([
            'deal.leadAgent.user.employeeDetail',
            'deal.contact',
            'lead.leadOwner.employeeDetail',
        ]);

        $company = $followUp->deal?->company ?? $followUp->lead?->company;
        if (! $company) {
            return;
        }

        $timezone = $company->timezone ?: 'UTC';
        $today = now($timezone)->toDateString();
        $cacheKey = "lead_followup_overdue_sent:{$followUp->id}:{$today}";

        if (Cache::has($cacheKey)) {
            return;
        }

        $recipients = $this->resolveOverdueRecipients($followUp);
        if ($recipients->isEmpty() && $company->id) {
            $recipients = User::allAdmins((int) $company->id)
                ->filter(fn (User $user) => $user->status === 'active')
                ->values();
        }

        if ($recipients->isEmpty()) {
            return;
        }

        Notification::send($recipients, new LeadFollowUpOverdue($followUp));
        Cache::put($cacheKey, true, now($timezone)->endOfDay());
    }

    /**
     * @return Collection<int, User>
     */
    public function resolveOverdueRecipients(DealFollowUp $followUp): Collection
    {
        $recipients = collect();

        $assignedAgent = $this->resolveAssignedAgent($followUp);
        if ($assignedAgent) {
            $recipients->push($assignedAgent);

            $manager = $this->resolveManager($assignedAgent);
            if ($manager) {
                $recipients->push($manager);
            }
        }

        return $recipients
            ->filter(fn ($user) => $user instanceof User && $user->status === 'active')
            ->unique('id')
            ->values();
    }

    /**
     * Follow-ups whose scheduled date has passed and are still open.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, DealFollowUp>
     */
    public function overdueFollowUpsForCompany(int $companyId, ?Carbon $now = null): \Illuminate\Database\Eloquent\Collection
    {
        $company = \App\Models\Company::find($companyId);
        $now = $now ?? now($company?->timezone ?: 'UTC');

        return DealFollowUp::query()
            ->with([
                'deal.leadAgent.user.employeeDetail',
                'deal.contact',
                'lead.leadOwner.employeeDetail',
            ])
            ->whereNotNull('next_follow_up_date')
            ->where('next_follow_up_date', '<', $now)
            ->where(function ($query) {
                $query->whereNull('status')
                    ->orWhereNotIn('status', ['completed', 'cancelled']);
            })
            ->where(function ($query) use ($companyId) {
                $query->whereHas('deal', function ($dealQuery) use ($companyId) {
                    $dealQuery
                        ->where('company_id', $companyId)
                        ->where('next_follow_up', 'yes');
                })->orWhere(function ($leadQuery) use ($companyId) {
                    $leadQuery
                        ->whereNull('deal_id')
                        ->whereNotNull('lead_id')
                        ->whereHas('lead', function ($q) use ($companyId) {
                            $q->where('company_id', $companyId)
                                ->whereNull('deleted_at');
                        });
                });
            })
            ->get()
            ->filter(fn (DealFollowUp $followUp) => ! $this->hasUpcomingIncompleteFollowUp($followUp, $now))
            ->values();
    }

    private function hasUpcomingIncompleteFollowUp(DealFollowUp $followUp, Carbon $now): bool
    {
        $query = DealFollowUp::query()
            ->where('id', '!=', $followUp->id)
            ->whereNotNull('next_follow_up_date')
            ->where('next_follow_up_date', '>=', $now)
            ->where(function ($statusQuery) {
                $statusQuery->whereNull('status')
                    ->orWhereIn('status', ['pending', 'incomplete', 'scheduled']);
            });

        if ($followUp->deal_id) {
            $query->where('deal_id', $followUp->deal_id);
        } elseif ($followUp->lead_id) {
            $query->where('lead_id', $followUp->lead_id)->whereNull('deal_id');
        } else {
            return false;
        }

        return $query->exists();
    }

    private function resolveAssignedAgent(DealFollowUp $followUp): ?User
    {
        if ($followUp->deal?->leadAgent?->user) {
            return $followUp->deal->leadAgent->user;
        }

        if ($followUp->lead?->leadOwner) {
            return $followUp->lead->leadOwner;
        }

        return null;
    }

    private function resolveManager(User $agent): ?User
    {
        $agent->loadMissing('employeeDetail.reportingTo');

        return $agent->employeeDetail?->reportingTo;
    }
}
