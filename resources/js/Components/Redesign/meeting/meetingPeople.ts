import type { DealFollowup } from "@/Types/api/deal-followup";
import { leadCallPhones } from "@/lib/leadCallPhones";

/** The person the meeting is with, and how to reach them. */
export interface MeetingLeadInfo {
    id: number;
    name: string;
    company: string | null;
    email: string | null;
    phones: string[];
}

/**
 * The lead behind a meeting, with the email and numbers they can be reached
 * on — shown next to them, because the meeting is with this person and the
 * first thing anyone does before it is check how to get hold of them.
 */
export function meetingLeadInfo(
    meeting: Pick<DealFollowup, "lead">,
): MeetingLeadInfo | null {
    const lead = meeting.lead;
    if (!lead) return null;

    return {
        id: lead.id,
        name: lead.client_name_salutation || lead.client_name || "",
        company: lead.company_name ?? null,
        email: lead.client_email?.trim() || null,
        phones: leadCallPhones(
            lead as Parameters<typeof leadCallPhones>[0],
        ).map((entry) => entry.phone),
    };
}
