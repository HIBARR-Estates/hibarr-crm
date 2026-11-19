<?php

namespace App\Services;

use App\Models\CalendlyBooking;
use App\Models\CalendlyMeetingLink;
use App\Models\DealFollowUp;
use App\Services\ApiV2\CrmWriteService;
use App\Support\CalendlyLinkBuilder;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Turns Calendly's booking notifications into meetings on the lead or deal the
 * booking link was opened for.
 */
class CalendlyBookingService
{
    public const CREATED = 'created';

    public const DUPLICATE = 'duplicate';

    public const CANCELED = 'canceled';

    /** Not one of ours (booked through someone else's link) or nothing to do. */
    public const IGNORED = 'ignored';

    /** Understood, but the CRM refused it (e.g. the lead no longer allows meetings). */
    public const REJECTED = 'rejected';

    public function __construct(private readonly CrmWriteService $crmWriteService) {}

    /**
     * @param  array<string, mixed>  $body  The decoded webhook body
     * @return self::*
     */
    public function handle(int $companyId, array $body): string
    {
        $payload = is_array($body['payload'] ?? null) ? $body['payload'] : [];

        return match ($body['event'] ?? null) {
            'invitee.created' => $this->created($companyId, $payload),
            'invitee.canceled' => $this->canceled($companyId, $payload),
            default => self::IGNORED,
        };
    }

    /**
     * @param  array<string, mixed>  $invitee
     */
    private function created(int $companyId, array $invitee): string
    {
        $inviteeUri = (string) ($invitee['uri'] ?? '');
        $event = is_array($invitee['scheduled_event'] ?? null) ? $invitee['scheduled_event'] : [];
        $startTime = (string) ($event['start_time'] ?? '');

        if ($inviteeUri === '' || $startTime === '') {
            return self::IGNORED;
        }

        $target = $this->resolveTarget($companyId, $invitee);

        if ($target === null) {
            return self::IGNORED;
        }

        $link = CalendlyMeetingLink::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->find($target['link_id']);

        // The row is claimed first: the unique invitee column is what stops two
        // simultaneous deliveries of the same booking from both creating a meeting.
        try {
            $booking = CalendlyBooking::create([
                'company_id' => $companyId,
                'calendly_meeting_link_id' => $link?->id,
                'record_type' => $target['record_type'],
                'record_id' => $target['record_id'],
                'invitee_uri' => $inviteeUri,
                'event_uri' => $event['uri'] ?? ($invitee['event'] ?? null),
                'status' => CalendlyBooking::STATUS_BOOKED,
            ]);
        } catch (UniqueConstraintViolationException) {
            return self::DUPLICATE;
        }

        try {
            $followUp = $this->crmWriteService->createMeeting($companyId, $this->meetingData($target, $link, $event));
        } catch (ValidationException|ModelNotFoundException $e) {
            // A permanent refusal. Forget the claim so the record is not left
            // looking booked, and let the caller answer 200: a retry cannot help.
            $booking->delete();
            Log::warning('Calendly booking could not be added as a meeting', [
                'company_id' => $companyId,
                'record_type' => $target['record_type'],
                'record_id' => $target['record_id'],
                'reason' => $e instanceof ValidationException ? $e->errors() : $e->getMessage(),
            ]);

            return self::REJECTED;
        } catch (\Throwable $e) {
            // Transient: release the claim so Calendly's retry can try again.
            $booking->delete();

            throw $e;
        }

        $booking->follow_up_id = $followUp->id;
        $booking->save();

        return self::CREATED;
    }

    /**
     * @param  array<string, mixed>  $invitee
     */
    private function canceled(int $companyId, array $invitee): string
    {
        $booking = CalendlyBooking::where('company_id', $companyId)
            ->where('invitee_uri', (string) ($invitee['uri'] ?? ''))
            ->first();

        if (! $booking || $booking->status === CalendlyBooking::STATUS_CANCELED) {
            return self::IGNORED;
        }

        $booking->status = CalendlyBooking::STATUS_CANCELED;
        $booking->save();

        $followUp = $booking->follow_up_id
            ? DealFollowUp::withoutGlobalScopes()->find($booking->follow_up_id)
            : null;

        // Only a meeting that has not happened yet: a completed one stays as
        // the record of what took place.
        if ($followUp && $followUp->status === 'scheduled') {
            $followUp->status = 'cancelled';
            $followUp->save();
        }

        return self::CANCELED;
    }

    /**
     * Who the booking is for: read from the link's signed tag, or, for a
     * rescheduled booking that arrives without it, from the booking it replaces.
     *
     * @param  array<string, mixed>  $invitee
     * @return array{record_type: string, record_id: int, link_id: int, user_id: int|null}|null
     */
    private function resolveTarget(int $companyId, array $invitee): ?array
    {
        $tracking = is_array($invitee['tracking'] ?? null) ? $invitee['tracking'] : [];
        $target = CalendlyLinkBuilder::parseTracking($tracking, $companyId);

        if ($target !== null) {
            return $target;
        }

        $previous = ! empty($invitee['old_invitee'])
            ? CalendlyBooking::where('company_id', $companyId)->where('invitee_uri', (string) $invitee['old_invitee'])->first()
            : null;

        if ($previous && $previous->record_type && $previous->record_id) {
            return [
                'record_type' => $previous->record_type,
                'record_id' => (int) $previous->record_id,
                'link_id' => (int) $previous->calendly_meeting_link_id,
                'user_id' => null,
            ];
        }

        return null;
    }

    /**
     * @param  array{record_type: string, record_id: int, link_id: int, user_id: int|null}  $target
     * @param  array<string, mixed>  $event
     * @return array<string, mixed>
     */
    private function meetingData(array $target, ?CalendlyMeetingLink $link, array $event): array
    {
        $location = is_array($event['location'] ?? null) ? $event['location'] : [];
        $joinUrl = $this->httpUrl($location['join_url'] ?? null);
        $eventName = trim((string) ($event['name'] ?? ''));
        $place = trim((string) ($location['location'] ?? ''));

        $remark = 'Booked through Calendly'.($eventName !== '' ? ': '.$eventName : '');

        if ($place !== '' && $joinUrl === null) {
            $remark .= "\n".$place;
        }

        $data = [
            $target['record_type'] === CalendlyLinkBuilder::RECORD_DEAL ? 'deal_id' : 'lead_id' => $target['record_id'],
            'scheduled_at' => (string) $event['start_time'],
            'location' => $this->location((string) ($location['type'] ?? '')),
            'meeting_link' => $joinUrl,
            'meeting_type_id' => $link?->meeting_type_id,
            'duration' => $this->durationMinutes((string) $event['start_time'], $event['end_time'] ?? null),
            'remark' => $remark,
        ];

        if ($target['user_id'] !== null) {
            $data['created_by_user_id'] = $target['user_id'];
        }

        return $data;
    }

    /** Calendly's location type, as the CRM's meeting platform. */
    private function location(string $calendlyType): string
    {
        return match ($calendlyType) {
            'zoom' => 'zoom',
            'google_conference' => 'google_meet',
            'microsoft_teams_conference' => 'teams',
            'inbound_call', 'outbound_call' => 'phone',
            'physical' => 'physical',
            default => 'other',
        };
    }

    private function httpUrl(mixed $value): ?string
    {
        $url = is_string($value) ? trim($value) : '';

        return preg_match('#^https?://#i', $url) === 1 && filter_var($url, FILTER_VALIDATE_URL) !== false ? $url : null;
    }

    /** Minutes between start and end; null when unusable so the CRM's default applies. */
    private function durationMinutes(string $start, mixed $end): ?int
    {
        if (! is_string($end) || trim($end) === '') {
            return null;
        }

        try {
            $minutes = (int) round((Carbon::parse($end)->getTimestamp() - Carbon::parse($start)->getTimestamp()) / 60);
        } catch (\Throwable) {
            return null;
        }

        return $minutes >= 1 && $minutes <= 600 ? $minutes : null;
    }
}
