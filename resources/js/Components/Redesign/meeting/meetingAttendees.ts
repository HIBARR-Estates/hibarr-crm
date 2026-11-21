import type { DealFollowup } from "../../../Types/api/deal-followup";

/** Someone who is on a meeting from the CRM's side. */
export interface MeetingAttendee {
    id: number;
    name: string;
    email?: string;
    /** Raw `image` column; empty means "show initials". */
    image?: string | null;
    image_url?: string | null;
    isHost: boolean;
}

/**
 * Everyone from the team who is on the meeting: the host first, then the
 * participants, each person once.
 *
 * The meeting stores them apart — `host_id` for who runs it, `participants`
 * for who else is invited, and the host is deliberately not repeated in the
 * participants — so a list built from the participants alone quietly leaves
 * the person running the meeting out. The host is `host_id`, else whoever
 * created the meeting, which is also whom the rest of the page calls the
 * organizer.
 */
export function meetingAttendees(
    meeting: Pick<
        DealFollowup,
        "host" | "host_id" | "added_by" | "participant_users"
    >,
): MeetingAttendee[] {
    const participants = meeting.participant_users ?? [];
    const hostId = meeting.host_id ?? meeting.added_by?.id ?? null;

    const attendees: MeetingAttendee[] = [];
    const seen = new Set<number>();

    if (hostId != null) {
        const fromParticipants = participants.find(
            (person) => person.id === hostId,
        );
        const host =
            meeting.host?.id === hostId
                ? meeting.host
                : meeting.added_by?.id === hostId
                  ? meeting.added_by
                  : fromParticipants;

        if (host) {
            attendees.push({
                id: hostId,
                name: host.name,
                email:
                    (host as { email?: string }).email ??
                    fromParticipants?.email,
                image: (host as { image?: string | null }).image ?? null,
                image_url:
                    (host as { image_url?: string | null }).image_url ??
                    fromParticipants?.image_url ??
                    null,
                isHost: true,
            });
            seen.add(hostId);
        }
    }

    for (const person of participants) {
        if (seen.has(person.id)) continue;
        seen.add(person.id);
        attendees.push({
            id: person.id,
            name: person.name,
            email: person.email,
            image: person.image ?? null,
            image_url: person.image_url ?? null,
            isHost: false,
        });
    }

    return attendees;
}
