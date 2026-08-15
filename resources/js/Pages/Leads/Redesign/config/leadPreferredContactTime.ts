export const PREFERRED_CONTACT_TIME_VALUES = [
    "morning",
    "afternoon",
    "evening",
] as const;

export type PreferredContactTimeValue =
    (typeof PREFERRED_CONTACT_TIME_VALUES)[number];

export const PREFERRED_CONTACT_TIME_LABELS: Record<
    PreferredContactTimeValue,
    string
> = {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
};

export function formatPreferredContactTime(value: string): string {
    return (
        PREFERRED_CONTACT_TIME_LABELS[value as PreferredContactTimeValue] ??
        value.charAt(0).toUpperCase() + value.slice(1)
    );
}

export function resolvePreferredContactTimes(
    lead: {
        preferred_contact_times?: string[] | null;
        preferred_contact_time?: string | null;
    } | null | undefined,
): PreferredContactTimeValue[] {
    if (
        Array.isArray(lead?.preferred_contact_times) &&
        lead.preferred_contact_times.length
    ) {
        return lead.preferred_contact_times.filter((value): value is PreferredContactTimeValue =>
            PREFERRED_CONTACT_TIME_VALUES.includes(value as PreferredContactTimeValue),
        );
    }

    if (lead?.preferred_contact_time) {
        const value = lead.preferred_contact_time as PreferredContactTimeValue;
        return PREFERRED_CONTACT_TIME_VALUES.includes(value) ? [value] : [];
    }

    return [];
}

export function formatPreferredContactTimes(values: string[]): string {
    return values.map(formatPreferredContactTime).join(", ");
}
