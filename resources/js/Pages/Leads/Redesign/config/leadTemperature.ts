/** Tone (matches `.v2-pill-*` CSS classes) for each manual lead temperature value. */
export const LEAD_TEMPERATURE_TONE: Record<string, string> = {
    cold: "blue",
    warm: "amber",
    hot: "red",
};

export function formatLeadTemperature(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
