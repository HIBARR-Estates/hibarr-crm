/**
 * Platforms whose invite and link go out by email — the same set as
 * `isVideoPlatform` and `MeetingContactability::ONLINE_LOCATIONS` on the
 * server. Kept here, rather than imported, so the rule can be tested on its own.
 */
const ONLINE_PLATFORMS = ["zoom", "zoho", "zoho_meet", "google_meet", "meet", "teams"];

/** How a lead can be reached, as the schedule endpoints report it. */
export interface MeetingContact {
    emails: string[];
    phones: string[];
    /** The lead the details belong to, for a link to add what is missing. */
    leadId?: number | null;
}

/** What a meeting needs from the person: `any` is "email or phone". */
export type ContactRequirement = "email" | "phone" | "any";

/**
 * What a meeting held on `platform` needs from the person — the same rule the
 * server applies when the meeting is saved (`MeetingContactability`).
 *
 * An online meeting is sent to an email address; a phone meeting needs a
 * number to call; an in-person one still has to be confirmed with them, by
 * either.
 */
export function contactRequirement(platform: string): ContactRequirement {
    if (ONLINE_PLATFORMS.includes(platform)) return "email";
    return platform === "phone" ? "phone" : "any";
}

/**
 * What is missing for a meeting on `platform`, or null when the person can be
 * reached the way it needs.
 */
export function contactShortfall(
    platform: string,
    contact: Pick<MeetingContact, "emails" | "phones">,
): ContactRequirement | null {
    const hasEmail = contact.emails.length > 0;
    const hasPhone = contact.phones.length > 0;

    switch (contactRequirement(platform)) {
        case "email":
            return hasEmail ? null : "email";
        case "phone":
            return hasPhone ? null : "phone";
        default:
            return hasEmail || hasPhone ? null : "any";
    }
}
