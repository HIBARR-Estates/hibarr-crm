<?php

namespace App\Services\Reminders;

use App\Models\LeadFlightItinerary;
use App\Models\Reminder;
use App\Support\ReminderFeature;

/**
 * Flight itinerary reminders use dynamic remind_at (not flight_date).
 */
class FlightItineraryReminderSync
{
    use BuildsUserReminderRecipients;

    public function __construct(
        private readonly ReminderCreator $creator
    ) {
    }

    public function syncFromItinerary(LeadFlightItinerary $itinerary): void
    {
        $itinerary->loadMissing(['lead', 'deal.leadAgent']);

        $companyId = $itinerary->deal?->company_id
            ?? $itinerary->lead?->company_id
            ?? null;
        $companyId = $companyId ? (int) $companyId : null;

        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $eventAt = ReminderEventAt::fromDateTime($itinerary->remind_at ?? null);
        if ($eventAt === null) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_FLIGHT_ITINERARY, (int) $itinerary->id);

            return;
        }

        $recipients = $this->buildRecipients($itinerary);
        if ($recipients === []) {
            $this->creator->cancelOpenForEntity(Reminder::ENTITY_FLIGHT_ITINERARY, (int) $itinerary->id);

            return;
        }

        $label = trim(implode(' ', array_filter([
            $itinerary->direction,
            $itinerary->flight_number,
            $itinerary->airport_name,
        ]))) ?: 'Flight itinerary';

        $this->creator->rebuildForEntity(
            $companyId,
            Reminder::ENTITY_FLIGHT_ITINERARY,
            (int) $itinerary->id,
            $eventAt,
            $recipients,
            $this->creator->cadenceFromCustomOffsets($itinerary->reminders ?? null),
            [
                'message' => $label,
                'created_by' => null,
                'added_by' => null,
            ]
        );
    }

    public function cancelForItinerary(LeadFlightItinerary $itinerary): void
    {
        $itinerary->loadMissing(['lead', 'deal']);
        $companyId = $itinerary->deal?->company_id
            ?? $itinerary->lead?->company_id
            ?? null;
        $companyId = $companyId ? (int) $companyId : null;

        if ($companyId === null || ! ReminderFeature::enabledForCompany($companyId)) {
            return;
        }

        $this->creator->cancelOpenForEntity(Reminder::ENTITY_FLIGHT_ITINERARY, (int) $itinerary->id);
    }

    /**
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    private function buildRecipients(LeadFlightItinerary $itinerary): array
    {
        $userIds = collect();

        if ($itinerary->lead?->lead_owner) {
            $userIds->push((int) $itinerary->lead->lead_owner);
        }
        if ($itinerary->lead?->added_by) {
            $userIds->push((int) $itinerary->lead->added_by);
        }
        $agentUserId = $itinerary->deal?->leadAgent?->user_id;
        if ($agentUserId) {
            $userIds->push((int) $agentUserId);
        }
        if ($itinerary->deal?->added_by) {
            $userIds->push((int) $itinerary->deal->added_by);
        }

        return $this->usersToRecipients($userIds);
    }
}
