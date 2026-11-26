import type { DealFollowup } from "@/Types/api/deal-followup";
import type { TelephonyCallEntity } from "@/Types/api/telephony";
import { leadCallPhones, type LeadCallPhone } from "@/lib/leadCallPhones";
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

/**
 * Who a phone meeting's call is logged against, and which numbers it can dial.
 *
 * The same shape the lead and deal pages hand the call button, so a call
 * placed from a meeting lands on the same record and goes through the same
 * line as one placed from either of them. The deal is the entity when the
 * meeting has one (the call is about that deal); otherwise the lead. Numbers
 * come from the lead, falling back to the deal's contact. Null when there is
 * no record or no number — nothing to dial.
 */
export function meetingCallTarget(
    meeting: DealFollowup,
): { entity: TelephonyCallEntity; phones: LeadCallPhone[] } | null {
    const dealId = meeting.deal_id ?? meeting.deal?.id ?? null;
    const leadId = meeting.lead_id ?? meeting.lead?.id ?? null;
    const entity: TelephonyCallEntity | null = dealId
        ? { type: "deal", id: dealId }
        : leadId
          ? { type: "lead", id: leadId }
          : null;
    if (!entity) return null;

    const contact = (
        meeting.deal as { contact?: Parameters<typeof leadCallPhones>[0] }
    )?.contact;
    const fromLead = leadCallPhones(
        meeting.lead as Parameters<typeof leadCallPhones>[0],
    );
    const phones = fromLead.length > 0 ? fromLead : leadCallPhones(contact);

    return phones.length > 0 ? { entity, phones } : null;
}

/** `tel:` href — keep leading + and digits only so the dialer gets a clean number. */
export function phoneTelHref(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, "");
    return cleaned ? `tel:${cleaned}` : "";
}
