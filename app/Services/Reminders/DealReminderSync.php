<?php

namespace App\Services\Reminders;

use App\Models\Deal;
use App\Models\Reminder;
use App\Support\ReminderFeature;

/**
 * Deal reminders use the deal's dynamic remind_at (not close_date).
 */
class DealReminderSync
{
    use BuildsUserReminderRecipients;

    public function __construct(
        private readonly ReminderCreator $creator
    ) {
    }

    public function syncFromDeal(Deal $deal): void
    {
        $companyId = $deal->company_id ? (int) $deal->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $eventAt = ReminderEventAt::fromDateTime($deal->remind_at ?? null);
        if ($eventAt === null) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_DEAL, (int) $deal->id);

            return;
        }

        $recipients = $this->buildRecipients($deal);
        if ($recipients === []) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_DEAL, (int) $deal->id);

            return;
        }

        $this->creator->rebuildForEntity(
            $companyId,
            Reminder::ENTITY_DEAL,
            (int) $deal->id,
            $eventAt,
            $recipients,
            $this->creator->cadenceFromCustomOffsets($deal->reminders ?? null),
            [
                'message' => $deal->name,
                'created_by' => $deal->added_by,
                'added_by' => $deal->added_by,
            ]
        );
    }

    public function cancelForDeal(Deal $deal): void
    {
        $companyId = $deal->company_id ? (int) $deal->company_id : null;
        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $this->creator->cancelOpenForEntity(Reminder::ENTITY_DEAL, (int) $deal->id);
    }

    /**
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function buildRecipients(Deal $deal): array
    {
        $deal->loadMissing(['leadAgent.user']);

        $userIds = collect();
        if ($deal->added_by) {
            $userIds->push((int) $deal->added_by);
        }
        $agentUserId = $deal->leadAgent?->user_id;
        if ($agentUserId) {
            $userIds->push((int) $agentUserId);
        }

        return $this->usersToRecipients($userIds);
    }
}
