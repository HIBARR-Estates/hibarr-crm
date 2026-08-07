<?php

namespace App\Support;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\User;
use App\Scopes\ActiveScope;
use App\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Builder;

/**
 * Resolves meeting participants and lead/contact emails for calendar
 * invites (ICS) and external calendar sync (OL / Zoho).
 */
class MeetingAttendeeResolver
{
    /**
     * @return list<int>
     */
    public static function resolveParticipantUserIds(DealFollowUp $followUp): array
    {
        return collect($followUp->participants ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return array{id: int, email: string, name: string}|null
     */
    public static function resolveLeadContact(DealFollowUp $followUp): ?array
    {
        $lead = self::resolveLead($followUp);
        if (!$lead) {
            return null;
        }

        $email = self::normalizeEmail($lead->client_email ?? $lead->email ?? null);
        if ($email === null) {
            return null;
        }

        return [
            'id' => (int) $lead->id,
            'email' => $email,
            'name' => trim((string) ($lead->client_name ?: $email)),
        ];
    }

    /**
     * External (non-CRM-user) guest emails — typically the lead/contact.
     *
     * @return list<string>
     */
    public static function resolveGuestEmails(DealFollowUp $followUp): array
    {
        $contact = self::resolveLeadContact($followUp);

        return $contact ? [$contact['email']] : [];
    }

    /**
     * Deal agent user id for deal-linked meetings. The agent receives a
     * calendar invite even when not listed as a meeting participant.
     * Watchers are optional — include them only by adding them as participants.
     *
     * @return list<int>
     */
    public static function resolveDealStakeholderUserIds(DealFollowUp $followUp): array
    {
        $deal = self::resolveDeal($followUp);
        $agentUserId = $deal?->leadAgent?->user_id;

        if (!$agentUserId) {
            return [];
        }

        $agentUserId = (int) $agentUserId;

        // Creator is the Zoho organizer — never also invite them as a guest.
        if ($followUp->added_by && $agentUserId === (int) $followUp->added_by) {
            return [];
        }

        // Already listed as a meeting participant — no separate agent invite.
        if (in_array($agentUserId, self::resolveParticipantUserIds($followUp), true)) {
            return [];
        }

        return [$agentUserId];
    }

    /**
     * Internal CRM users who should receive a calendar invite: meeting
     * participants plus the deal agent when the meeting is deal-linked.
     * The meeting creator is excluded — OL sends them as organizer via
     * creatorUserId.
     *
     * @return list<int>
     */
    public static function resolveInternalInviteUserIds(DealFollowUp $followUp): array
    {
        $ids = collect(self::resolveParticipantUserIds($followUp))
            ->merge(self::resolveDealStakeholderUserIds($followUp))
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique();

        if ($followUp->added_by) {
            $ids = $ids->reject(fn (int $id) => $id === (int) $followUp->added_by);
        }

        return $ids->values()->all();
    }

    /**
     * @return list<array{email: string, name: string, type: string, userId?: int, leadId?: int}>
     */
    public static function resolveAttendees(DealFollowUp $followUp): array
    {
        $attendees = [];
        $seenEmails = [];

        $userIds = self::resolveInternalInviteUserIds($followUp);
        if ($userIds !== []) {
            $users = self::usersQueryForFollowUp($followUp)
                ->whereIn('id', $userIds)
                ->get(['id', 'name', 'email']);

            foreach ($users as $user) {
                $email = self::normalizeEmail($user->email);
                if ($email === null || isset($seenEmails[$email])) {
                    continue;
                }

                $seenEmails[$email] = true;
                $attendees[] = [
                    'type' => 'user',
                    'userId' => (int) $user->id,
                    'email' => $email,
                    'name' => $user->name ?: $email,
                ];
            }
        }

        $contact = self::resolveLeadContact($followUp);
        if ($contact && !isset($seenEmails[$contact['email']])) {
            $seenEmails[$contact['email']] = true;
            $attendees[] = [
                'type' => 'guest',
                'leadId' => $contact['id'],
                'email' => $contact['email'],
                'name' => $contact['name'],
            ];
        }

        return $attendees;
    }

    /**
     * Emails OL/Zoho should invite: meeting participants, the deal agent
     * (for deal meetings), and the lead/contact when their email is known.
     * The meeting creator is excluded — they are the organizer.
     *
     * @return list<string>
     */
    public static function resolveAttendeeEmails(DealFollowUp $followUp): array
    {
        $emails = [];
        $seen = [];

        foreach (self::resolveAttendees($followUp) as $attendee) {
            $email = $attendee['email'];
            if (!isset($seen[$email])) {
                $seen[$email] = true;
                $emails[] = $email;
            }
        }

        foreach (self::resolveGuestEmails($followUp) as $guestEmail) {
            if (!isset($seen[$guestEmail])) {
                $seen[$guestEmail] = true;
                $emails[] = $guestEmail;
            }
        }

        return self::withoutCreatorEmail($followUp, $emails);
    }

    /**
     * @param  list<string>  $emails
     * @return list<string>
     */
    private static function withoutCreatorEmail(DealFollowUp $followUp, array $emails): array
    {
        $creatorEmail = self::resolveCreatorEmail($followUp);
        if ($creatorEmail === null) {
            return $emails;
        }

        return array_values(array_filter(
            $emails,
            fn (string $email) => strtolower(trim($email)) !== $creatorEmail
        ));
    }

    private static function resolveCreatorEmail(DealFollowUp $followUp): ?string
    {
        if (!$followUp->added_by) {
            return null;
        }

        $followUp->loadMissing([
            'addedBy' => fn ($query) => $query->withoutGlobalScope(ActiveScope::class),
        ]);

        return self::normalizeEmail($followUp->addedBy?->email);
    }

    private static function resolveLead(DealFollowUp $followUp): ?Lead
    {
        self::ensureLeadRelationsLoaded($followUp);

        if ($followUp->lead) {
            return $followUp->lead;
        }

        if ($followUp->deal?->contact) {
            return $followUp->deal->contact;
        }

        $leadId = $followUp->lead_id ?? $followUp->deal?->lead_id;
        if (!$leadId) {
            return null;
        }

        return Lead::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->find($leadId);
    }

    private static function resolveDeal(DealFollowUp $followUp): ?Deal
    {
        if ($followUp->relationLoaded('deal') && $followUp->deal) {
            self::ensureDealStakeholdersLoaded($followUp->deal);

            return $followUp->deal;
        }

        if (!$followUp->deal_id) {
            return null;
        }

        return Deal::query()
            ->withoutGlobalScope(CompanyScope::class)
            ->with(self::dealStakeholderRelations())
            ->find($followUp->deal_id);
    }

    /**
     * @return array<string, mixed>
     */
    private static function dealStakeholderRelations(): array
    {
        return [
            'contact' => fn ($query) => $query->withoutGlobalScope(CompanyScope::class),
            'leadAgent.user' => fn ($query) => $query->withoutGlobalScope(ActiveScope::class),
        ];
    }

    private static function ensureDealStakeholdersLoaded(Deal $deal): void
    {
        $deal->loadMissing(self::dealStakeholderRelations());
    }

    private static function ensureLeadRelationsLoaded(DealFollowUp $followUp): void
    {
        $followUp->loadMissing([
            'lead' => fn ($query) => $query->withoutGlobalScope(CompanyScope::class),
            'deal' => fn ($query) => $query
                ->withoutGlobalScope(CompanyScope::class)
                ->with(self::dealStakeholderRelations()),
        ]);
    }

    /**
     * @return Builder<User>
     */
    private static function usersQueryForFollowUp(DealFollowUp $followUp): Builder
    {
        $companyId = self::resolveCompanyId($followUp);

        $query = User::query()->withoutGlobalScope(ActiveScope::class);

        if ($companyId) {
            $query->where('company_id', (int) $companyId);
        }

        return $query;
    }

    private static function resolveCompanyId(DealFollowUp $followUp): ?int
    {
        $deal = self::resolveDeal($followUp);
        if ($deal?->company_id) {
            return (int) $deal->company_id;
        }

        $lead = self::resolveLead($followUp);
        if ($lead?->company_id) {
            return (int) $lead->company_id;
        }

        return null;
    }

    private static function normalizeEmail(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $email = strtolower(trim($value));

        return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }
}
