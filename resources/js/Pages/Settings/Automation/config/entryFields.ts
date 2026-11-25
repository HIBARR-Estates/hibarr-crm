import type { AutomationCatalog } from "../types";

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

/**
 * A channel as the picker shows it: named by its path ("Consultation booking › Consultation (DE)") so the
 * tree is readable and a selected chip stands on its own, archived ones marked.
 */
export function channelOptions(catalog: AutomationCatalog): Option[] {
    const channels = catalog.entryChannels ?? [];
    const byUuid = new Map(channels.map((channel) => [channel.uuid, channel]));
    const trail = (channel: (typeof channels)[number]): string[] => {
        const names = [channel.name];
        let parent = channel.parentUuid ? byUuid.get(channel.parentUuid) : undefined;
        // Three levels at most; the cap only guards against a malformed parent loop.
        for (let hops = 0; parent && hops < 10; hops += 1) {
            names.unshift(parent.name);
            parent = parent.parentUuid ? byUuid.get(parent.parentUuid) : undefined;
        }
        return names;
    };
    return channels.map((channel) => ({
        value: channel.uuid,
        label: `${trail(channel).join(" › ")}${channel.status === "archived" ? " (archived)" : ""}`,
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
