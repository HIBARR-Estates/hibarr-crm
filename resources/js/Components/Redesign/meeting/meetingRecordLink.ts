import type { DealFollowup } from "@/Types/api/deal-followup";

export interface MeetingRecordLink {
    name: string;
    href: string | null;
    /** Which kind of record, so callers can label the link correctly. */
    type: "deal" | "lead";
}

/** The deal or lead a meeting hangs off, and where clicking it goes. */
export function meetingRecordLink(
    meeting: DealFollowup,
): MeetingRecordLink | null {
    if (meeting.deal) {
        return {
            name: meeting.deal.name,
            href: `/account/deals/${meeting.deal.id}`,
            type: "deal",
        };
    }
    if (meeting.lead) {
        return {
            name:
                meeting.lead.client_name_salutation ||
                meeting.lead.client_name ||
                "",
            href: route("lead-contact.show", meeting.lead.id),
            type: "lead",
        };
    }
    return null;
}

