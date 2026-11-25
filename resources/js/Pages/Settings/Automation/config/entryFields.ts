import { AutomationCatalog } from "../types";

/**
 * Condition fields about the entry a lead came in through (see AutomationFieldCatalog::ENTRY_FIELDS and
 * LeadEntryFieldResolver on the server). `membership` fields resolve to a list, so "Contains" means
 * "is in this channel or one below it" / "has this tag", and "Exists" means "there is one".
 */
export type EntryFieldKind = "membership" | "select" | "string" | "number";

const ENTRY_FIELD_KIND: Record<string, EntryFieldKind> = {
    entry_channel: "membership",
    first_entry_channel: "membership",
    entry_channel_tag: "membership",
    entry_channel_type: "select",
    first_entry_channel_type: "select",
    entry_channel_family: "select",
    entry_partner: "select",
    entry_referral_agent: "select",
    entry_is_new_lead: "select",
    entry_campaign: "string",
    entry_attribution_link: "string",
    entry_utm_source: "string",
    entry_utm_medium: "string",
    entry_count_30d: "number",
};

export function isEntryField(fieldKey: string | null | undefined, catalog: AutomationCatalog | null): boolean {
    return !!fieldKey && !!catalog?.entryFields && fieldKey in catalog.entryFields;
}

export function entryFieldKind(fieldKey: string): EntryFieldKind {
    return ENTRY_FIELD_KIND[fieldKey] ?? "string";
}

type Option = { value: string; label: string };

/** A channel as the picker shows it: indented by depth so the tree reads, archived ones marked. */
export function channelOptions(catalog: AutomationCatalog): Option[] {
    return (catalog.entryChannels ?? []).map((channel) => ({
        value: channel.uuid,
        label: `${"· ".repeat(channel.depth)}${channel.name}${channel.status === "archived" ? " (archived)" : ""}`,
    }));
}

/** The picker for an entry field's Value, or null for free text. */
export function entryFieldValueOptions(fieldKey: string, catalog: AutomationCatalog): Option[] | null {
    switch (fieldKey) {
        case "entry_channel":
        case "first_entry_channel":
            return channelOptions(catalog);
        case "entry_channel_type":
        case "first_entry_channel_type":
            // A type's root is named after the type, so the roots are the type list.
            return (catalog.entryChannels ?? [])
                .filter((channel) => channel.depth === 0)
                .map((channel) => ({ value: channel.type, label: channel.name }));
        case "entry_channel_family":
            return [
                { value: "form", label: "Form" },
                { value: "referral", label: "Referral" },
            ];
        case "entry_partner":
        case "entry_referral_agent":
            return catalog.users.map((user) => ({
                value: String(user.id),
                label: user.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || `#${user.id}`,
            }));
        case "entry_is_new_lead":
            return [
                { value: "1", label: "True / Yes" },
                { value: "0", label: "False / No" },
            ];
        default:
            return null;
    }
}
