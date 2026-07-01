import { describe, expect, it } from "vitest";
import { formatLocationNameForDisplay } from "./utils";

describe("Location name display formatting", () => {
    it("[unit] should render a location name in capital case regardless of stored casing", () => {
        expect(formatLocationNameForDisplay("belek, antalya")).toBe(
            "Belek, Antalya",
        );
        expect(formatLocationNameForDisplay("ISTANBUL")).toBe("Istanbul");
        expect(formatLocationNameForDisplay("kyrenia_north")).toBe(
            "Kyrenia North",
        );
    });

    it("[unit] should not mutate the underlying stored location name value", () => {
        const stored = "belek, antalya";
        const displayed = formatLocationNameForDisplay(stored);
        expect(displayed).toBe("Belek, Antalya");
        expect(stored).toBe("belek, antalya");
    });

    it("[unit] should handle empty and null values", () => {
        expect(formatLocationNameForDisplay("")).toBe("");
        expect(formatLocationNameForDisplay(null)).toBe("");
        expect(formatLocationNameForDisplay(undefined)).toBe("");
    });
});
