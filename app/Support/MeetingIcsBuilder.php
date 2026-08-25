<?php

namespace App\Support;

use App\Models\DealFollowUp;
use App\Support\MeetingAttendeeResolver;
use Eluceo\iCal\Component\Calendar;
use Eluceo\iCal\Component\Event as VEvent;
use Eluceo\iCal\Property\Event\Organizer;

/**
 * Builds the .ics calendar invite attached to meeting emails — the "meeting
 * created" notice and the scheduled reminders — so recipients can drop it
 * straight into their calendar instead of just reading about it.
 *
 * UID is stable per DealFollowUp so re-sends (edits, additional reminders)
 * update the same calendar entry rather than creating duplicates.
 */
class MeetingIcsBuilder
{
    private const DEFAULT_DURATION_MINUTES = 30;

    /**
     * @return array{content: string, filename: string}|null Null when there's no meeting time to build an event around.
     */
    public static function build(DealFollowUp $followUp): ?array
    {
        if (! $followUp->next_follow_up_date) {
            return null;
        }

        $followUp->loadMissing(['deal.contact', 'lead', 'addedBy', 'meetingType']);

        $start = $followUp->next_follow_up_date->copy()->timezone('UTC');
        $durationMinutes = max((int) ($followUp->duration ?: self::DEFAULT_DURATION_MINUTES), 5);
        $end = $start->copy()->addMinutes($durationMinutes);

        $lead = $followUp->lead ?? $followUp->deal?->contact;
        $leadName = $followUp->deal?->client_name ?? $lead?->client_name ?? '';
        $meetingTypeName = $followUp->meetingType?->name ?: 'Meeting';

        $summary = trim($meetingTypeName.($leadName !== '' ? ' with '.$leadName : ''));

        $vCalendar = new Calendar(config('app.name').' Meeting Invite');
        $vCalendar->setMethod('REQUEST');

        $vEvent = new VEvent();
        $vEvent
            ->setUniqueId(self::uid($followUp))
            ->setDtStart($start)
            ->setDtEnd($end)
            ->setUseUtc(true)
            ->setSequence((int) ($followUp->updated_at?->timestamp ?? 0))
            ->setStatus('CONFIRMED')
            ->setSummary($summary);

        $description = self::buildDescription($followUp, $leadName);
        if ($description !== '') {
            $vEvent->setDescription($description);
        }

        $location = self::resolveLocation($followUp);
        if ($location !== '') {
            $vEvent->setLocation($location);
        }

        $organizer = $followUp->addedBy;
        if (! empty($organizer?->email)) {
            $vEvent->setOrganizer(new Organizer(
                'mailto:'.$organizer->email,
                ['CN' => $organizer->name ?? $organizer->email]
            ));
        }

        foreach (MeetingAttendeeResolver::resolveAttendees($followUp) as $attendee) {
            $vEvent->addAttendee('mailto:'.$attendee['email'], [
                'CN' => $attendee['name'],
                'ROLE' => 'REQ-PARTICIPANT',
                'PARTSTAT' => 'NEEDS-ACTION',
                'RSVP' => 'TRUE',
            ]);
        }

        $vCalendar->addEvent($vEvent);

        return [
            'content' => $vCalendar->render(),
            'filename' => 'meeting.ics',
        ];
    }

    private static function buildDescription(DealFollowUp $followUp, string $leadName): string
    {
        $lines = [];

        if ($leadName !== '') {
            $lines[] = 'With: '.$leadName;
        }

        if (! empty($followUp->remark)) {
            $lines[] = trim((string) $followUp->remark);
        }

        if (
            MeetingLocation::supportsJoinLink($followUp->location ?? null)
            && ! empty($followUp->meeting_link)
            && filter_var($followUp->meeting_link, FILTER_VALIDATE_URL)
        ) {
            $lines[] = 'Join: '.$followUp->meeting_link;
        }

        return implode("\n\n", $lines);
    }

    private static function resolveLocation(DealFollowUp $followUp): string
    {
        if (
            MeetingLocation::supportsJoinLink($followUp->location ?? null)
            && ! empty($followUp->meeting_link)
            && filter_var($followUp->meeting_link, FILTER_VALIDATE_URL)
        ) {
            return $followUp->meeting_link;
        }

        return trim((string) ($followUp->location ?? ''));
    }

    private static function uid(DealFollowUp $followUp): string
    {
        return 'meeting-'.$followUp->id.'@'.self::host();
    }

    private static function host(): string
    {
        $host = parse_url((string) config('app.url'), PHP_URL_HOST);

        return is_string($host) && $host !== '' ? $host : 'hibarr-crm.local';
    }
}
