import type { DealFollowup } from "@/Types/api/deal-followup";
import { resolveLeadPhoneDisplay } from "@/lib/utils";

type PhoneSource = {
    mobile?: string | null;
    cell?: string | null;
    office?: string | null;
    mobile_with_phonecode?: string | null;
    office_phone_formatted?: string | null;
};

/**
 * Best phone number on the lead or deal contact this meeting hangs off.
 *
 * Phone meetings don't store a number on the follow-up itself — the call goes
 * to whoever the meeting is with, so we resolve it from the linked record.
 */
export function meetingContactPhone(meeting: DealFollowup): string {
    const lead = meeting.lead as PhoneSource | undefined;
    const contact = (
        meeting.deal as { contact?: PhoneSource } | undefined
    )?.contact;

    return (
        resolveLeadPhoneDisplay(lead?.mobile, lead?.mobile_with_phonecode) ||
        resolveLeadPhoneDisplay(lead?.cell) ||
        resolveLeadPhoneDisplay(lead?.office, lead?.office_phone_formatted) ||
        resolveLeadPhoneDisplay(
            contact?.mobile,
            contact?.mobile_with_phonecode,
        ) ||
        resolveLeadPhoneDisplay(contact?.cell) ||
        resolveLeadPhoneDisplay(
            contact?.office,
            contact?.office_phone_formatted,
        ) ||
        ""
    );
}

/** `tel:` href — keep leading + and digits only so the dialer gets a clean number. */
export function phoneTelHref(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, "");
    return cleaned ? `tel:${cleaned}` : "";
}
