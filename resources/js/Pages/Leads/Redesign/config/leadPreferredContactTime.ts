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

export function formatPreferredContactTimes(
    times?: string[] | null,
    fallback?: string | null,
): string {
    const values =
        times && times.length > 0
            ? times
            : fallback
              ? [fallback]
              : [];

    return values.map((value) => formatPreferredContactTime(value)).join(", ");
}
