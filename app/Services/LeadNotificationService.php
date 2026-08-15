<?php

namespace App\Services;

use App\Enums\LeadActivityType;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\User;
use App\Notifications\BaseNotification;
use App\Notifications\LeadActivityNotification;
use App\Notifications\LeadDeleted;
use App\Notifications\LeadFollowUpOverdue;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class LeadNotificationService
{
    /**
     * Send notifications for a lead contact activity.
     */
    public function notifyLeadActivity(
        Lead $lead,
        LeadActivityType $activityType,
        array $additionalData = [],
        ?int $excludeUserId = null,
        ?Collection $recipients = null,
        ?LeadNote $note = null,
    ): void {
        $excludeUserId = $excludeUserId ?? (user()?->id);
        $notifiableUsers = $recipients ?? $this->getNotifiableUsers($lead, $excludeUserId, $note);

        if ($notifiableUsers->isEmpty()) {
            return;
        }

        $notificationData = $this->buildNotificationData($lead, $activityType, $additionalData, $excludeUserId);
        $notification = new LeadActivityNotification($lead, $activityType, $notificationData);

        Notification::send(
            $notifiableUsers,
            BaseNotification::applySuppressionFromContainer($notification),
        );
    }

    public function notifyNoteAdded(Lead $lead, string $noteTitle, ?int $noteId = null, ?LeadNote $note = null): void
    {
        $this->notifyLeadActivity($lead, LeadActivityType::NOTE_ADDED, [
            'note_title' => $noteTitle,
            'note_id' => $noteId,
        ], null, null, $note);
    }

    public function notifyNoteUpdated(Lead $lead, string $noteTitle, ?int $noteId = null, ?LeadNote $note = null): void
    {
        $this->notifyLeadActivity($lead, LeadActivityType::NOTE_UPDATED, [
            'note_title' => $noteTitle,
            'note_id' => $noteId,
        ], null, null, $note);
    }

    public function notifyNoteDeleted(Lead $lead, string $noteTitle, ?int $noteId = null, ?LeadNote $note = null): void
    {
        $this->notifyLeadActivity($lead, LeadActivityType::NOTE_DELETED, [
            'note_title' => $noteTitle,
            'note_id' => $noteId,
        ], null, null, $note);
    }

    public function notifyFileUploaded(Lead $lead, string $fileName, ?int $fileId = null): void
    {
        $this->notifyLeadActivity($lead, LeadActivityType::FILE_UPLOADED, [
            'file_name' => $fileName,
            'file_id' => $fileId,
        ]);
    }

    public function notifyFileUpdated(Lead $lead, string $fileName, ?int $fileId = null): void
    {
        $this->notifyLeadActivity($lead, LeadActivityType::FILE_UPDATED, [
            'file_name' => $fileName,
            'file_id' => $fileId,
        ]);
    }

    public function notifyFileDeleted(Lead $lead, string $fileName, ?int $fileId = null): void
    {
        $this->notifyLeadActivity($lead, LeadActivityType::FILE_DELETED, [
            'file_name' => $fileName,
            'file_id' => $fileId,
        ]);
    }

    /**
     * Lead owner + private-note members; admins when nobody qualifies.
     *
     * @return Collection<int, User>
     */
    public function getNotifiableUsers(Lead $lead, ?int $excludeUserId = null, ?LeadNote $note = null): Collection
    {
        $lead->loadMissing(['leadOwner', 'company']);

        $userIds = collect();

        if ($lead->lead_owner) {
            $userIds->push((int) $lead->lead_owner);
        }

        if ($note && (int) $note->type === 1) {
            $note->loadMissing('members');
            $userIds = $userIds->merge($note->members->pluck('user_id'));
        }

        $excludedIds = collect([$excludeUserId])->filter()->unique();
        $userIds = $userIds->unique()->filter(function ($userId) use ($excludedIds) {
            if ($userId === null) {
                return false;
            }

            return ! $excludedIds->contains(fn ($excludedId) => (int) $userId === (int) $excludedId);
        });

        if ($userIds->isEmpty() && $lead->company_id) {
            return $this->activeAdminsForCompany((int) $lead->company_id, $excludeUserId);
        }

        if ($userIds->isEmpty()) {
            return collect();
        }

        return User::whereIn('id', $userIds->toArray())
            ->where('status', 'active')
            ->get();
    }

    /**
     * @return Collection<int, User>
     */
    protected function activeAdminsForCompany(int $companyId, ?int $excludeUserId = null): Collection
    {
        $excludedIds = collect([$excludeUserId])->filter()->unique();

        return User::allAdmins($companyId)
            ->filter(fn (User $user) => $user->status === 'active' && ! $excludedIds->contains($user->id))
            ->values();
    }

    protected function buildNotificationData(
        Lead $lead,
        LeadActivityType $activityType,
        array $additionalData,
        ?int $triggeredByUserId,
    ): array {
        $triggeredBy = $triggeredByUserId
            ? User::find($triggeredByUserId)
            : user();

        return array_merge([
            'lead_id' => $lead->id,
            'lead_name' => $lead->client_name,
            'activity_type' => $activityType->value,
            'activity_label' => $activityType->label(),
            'activity_icon' => $activityType->icon(),
            'triggered_by_id' => $triggeredBy?->id,
            'triggered_by_name' => $triggeredBy?->name ?? 'System',
            'company_id' => $lead->company_id,
        ], $additionalData);
    }

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
            'deal.company',
            'lead.leadOwner.employeeDetail',
            'lead.company',
        ]);

        $company = $followUp->deal?->company ?? $followUp->lead?->company;
        if (! $company) {
            return;
        }

        $timezone = $company->timezone ?: 'UTC';
        $today = now($timezone)->toDateString();
        $cacheKey = "lead_followup_overdue_sent:{$followUp->id}:{$today}";

        if (Cache::add($cacheKey, true, now($timezone)->endOfDay()) === false) {
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

        if (! config('app.automations.followups.overdue_email_enabled', false)) {
            Log::info('[LeadFollowUpOverdue] Email disabled; sending in-app notification only.', [
                'follow_up_id' => $followUp->id,
                'deal_id' => $followUp->deal_id,
                'lead_id' => $followUp->lead_id,
                'entity_name' => trim((string) (
                    $followUp->deal?->name
                    ?? $followUp->deal?->contact?->client_name
                    ?? $followUp->lead?->client_name
                    ?? ''
                )),
                'scheduled_at' => $followUp->next_follow_up_date?->toIso8601String(),
                'recipient_ids' => $recipients->pluck('id')->values()->all(),
            ]);
        }

        Notification::send($recipients, new LeadFollowUpOverdue($followUp));
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
        $storageNow = $now->copy()->timezone(config('app.timezone'));

        return DealFollowUp::query()
            ->with([
                'deal.leadAgent.user.employeeDetail',
                'deal.contact',
                'deal.company',
                'lead.leadOwner.employeeDetail',
                'lead.company',
            ])
            ->whereNotNull('next_follow_up_date')
            ->where('next_follow_up_date', '<', $storageNow)
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
            ->pipe(fn ($followUps) => $this->excludeFollowUpsWithUpcoming($followUps, $now))
            ->values();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, DealFollowUp>  $followUps
     * @return \Illuminate\Support\Collection<int, DealFollowUp>
     */
    private function excludeFollowUpsWithUpcoming(\Illuminate\Support\Collection $followUps, Carbon $now): \Illuminate\Support\Collection
    {
        if ($followUps->isEmpty()) {
            return $followUps;
        }

        $dealIds = $followUps->pluck('deal_id')->filter()->unique()->values()->all();
        $leadIds = $followUps->whereNull('deal_id')->pluck('lead_id')->filter()->unique()->values()->all();

        $dealIdsWithUpcoming = $this->entityIdsWithUpcomingIncompleteFollowUp('deal_id', $dealIds, $now);
        $leadIdsWithUpcoming = $this->entityIdsWithUpcomingIncompleteFollowUp('lead_id', $leadIds, $now, true);

        return $followUps->reject(function (DealFollowUp $followUp) use ($dealIdsWithUpcoming, $leadIdsWithUpcoming) {
            if ($followUp->deal_id) {
                return in_array((int) $followUp->deal_id, $dealIdsWithUpcoming, true);
            }

            if ($followUp->lead_id) {
                return in_array((int) $followUp->lead_id, $leadIdsWithUpcoming, true);
            }

            return false;
        });
    }

    /**
     * @param  list<int>  $entityIds
     * @return list<int>
     */
    private function entityIdsWithUpcomingIncompleteFollowUp(string $column, array $entityIds, Carbon $now, bool $leadOnly = false): array
    {
        if ($entityIds === []) {
            return [];
        }

        $storageNow = $now->copy()->timezone(config('app.timezone'));

        $query = DealFollowUp::query()
            ->whereIn($column, $entityIds)
            ->whereNotNull('next_follow_up_date')
            ->where('next_follow_up_date', '>=', $storageNow)
            ->where(function ($statusQuery) {
                $statusQuery->whereNull('status')
                    ->orWhereIn('status', ['pending', 'incomplete', 'scheduled']);
            });

        if ($leadOnly) {
            $query->whereNull('deal_id');
        }

        return $query->pluck($column)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
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
