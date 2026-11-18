/**
 * Pure helpers behind DealMoneyInput. The field keeps raw digits with at most one
 * "." (see DealMoneyInput); these turn what a person types or pastes into that.
 */

/** Digits and a single decimal point. Everything else is dropped. */
export function sanitizeAmount(text: string): string {
    const kept = text.replace(/[^0-9.]/g, "");
    const firstDot = kept.indexOf(".");

    return firstDot === -1
        ? kept
        : kept.slice(0, firstDot + 1) + kept.slice(firstDot + 1).replace(/\./g, "");
}

/**
 * Reads a pasted amount into the raw form, or null when it cannot be read
 * without guessing. Never drops a separator and submits a different amount.
 *
 * - "12,50" and "12.50" are 12.50; "1.234,50" and "1,234.50" are 1234.50 (the
 *   last separator is the decimal point, the other only groups).
 * - Several of one separator are grouping when laid out as groups of three:
 *   "1,234,567" and "1.234.567" are 1234567. "1,2,3" is rejected.
 * - A lone comma before exactly three digits is grouping ("1,500" is 1500), the
 *   way this app writes amounts. A lone dot is always a decimal point.
 */
export function parsePastedAmount(text: string): string | null {
    const cleaned = text.replace(/[^\d.,]/g, "");

    if (!/\d/.test(cleaned)) {
        return null;
    }

    const strip = (value: string) => value.replace(/[.,]/g, "");
    const join = (whole: string, fraction: string) =>
        fraction === "" ? strip(whole) : `${strip(whole)}.${fraction}`;
    const hasDot = cleaned.includes(".");
    const hasComma = cleaned.includes(",");

    if (hasDot && hasComma) {
        const at = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
        const decimal = cleaned[at];
        const grouping = decimal === "." ? "," : ".";
        const whole = cleaned.slice(0, at);

        // The decimal separator appears once, and the other one only groups: in
        // groups of three, nothing after the decimal point.
        const groupedWhole = new RegExp(`^\\d{1,3}(\\${grouping}\\d{3})*$`).test(whole);
        const plainWhole = !whole.includes(grouping) && !whole.includes(decimal);

        if (cleaned.slice(at + 1).includes(grouping) || !(groupedWhole || plainWhole)) {
            return null;
        }

        return join(whole, cleaned.slice(at + 1));
    }

    const separator = hasComma ? "," : hasDot ? "." : null;

    if (separator === null) {
        return cleaned;
    }

    const occurrences = cleaned.split(separator).length - 1;
    const grouped = new RegExp(`^\\d{1,3}(\\${separator}\\d{3})+$`).test(cleaned);

    if (occurrences > 1) {
        return grouped ? strip(cleaned) : null;
    }

    if (separator === "," && grouped) {
        return strip(cleaned);
    }

    const at = cleaned.indexOf(separator);

    return join(cleaned.slice(0, at), cleaned.slice(at + 1));
}
