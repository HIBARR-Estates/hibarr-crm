/**
 * Lightweight itinerary preview — full UI lives in LeadFlightItineraryTab.
 * Kept for count/label helpers in the workspace tab bar.
 */
export interface LeadItineraryPreview {
    id: number;
    label: string;
}

export function itineraryCount(items: unknown[] | undefined | null): number {
    return Array.isArray(items) ? items.length : 0;
}
