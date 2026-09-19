/**
 * Display helpers shared by every v2 dashboard.
 *
 * Pure functions with no hook access, so they can run outside the render path
 * and inside `useMemo` — same split as Deals/Redesign/adapters.
 *
 * Only what genuinely crosses views lives here. Anything that only the
 * personal dashboard's own panels need stays in `personal/format.ts`.
 */

import dayjs from "dayjs";

const CURRENCY_SYMBOLS: Record<string, string> = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    TRY: "₺",
    AED: "AED ",
    CHF: "CHF ",
};

/**
 * €965,000 under a million, €1.24M above.
 *
 * Exact below the threshold because a deal value is a real figure someone
 * quoted; abbreviated above it because a pipeline total is a magnitude, and
 * eleven digits in a stat tile read as noise.
 */
export function money(total: number, currency: string): string {
    const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;

    if (Math.abs(total) >= 1_000_000) {
        return `${symbol}${(total / 1_000_000).toFixed(2)}M`;
    }

    return `${symbol}${Math.round(total).toLocaleString("en-US")}`;
}

/**
 * A figure whose currency might not be known.
 *
 * Commission always arrives in the company's own currency, but a company with
 * no default currency configured has none to name. Renders bare rather than
 * stamping a symbol we had to guess on a financial figure.
 */
export function amount(value: number, currency: string | null): string {
    return currency
        ? money(value, currency)
        : Math.round(value).toLocaleString("en-US");
}

/**
 * "Good morning" / "Good afternoon" / "Good evening", from the page's clock.
 *
 * English source string — the caller translates it through td().
 */
export function greetingFor(now: string): string {
    const hour = dayjs(now).hour();

    if (hour < 12) return "Good morning";

    return hour < 18 ? "Good afternoon" : "Good evening";
}
