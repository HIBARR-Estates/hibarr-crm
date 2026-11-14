/** The Intl locale for the app language (English is shown as en-GB: day first, euros after the symbol). */
export function intlLocale(locale: string): string {
    return locale === "en" || locale === "eng" ? "en-GB" : String(locale);
}

const SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", TRY: "₺" };

/** "€ 239,000": the currency symbol, a space, thousands separators. */
export function formatPrice(amount: number | null, currency: string | null, locale: string): string {
    if (amount === null) return "";
    const code = (currency ?? "").toUpperCase();
    const symbol = SYMBOLS[code] ?? (code ? `${code}` : "");
    const number = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(amount);
    return symbol ? `${symbol} ${number}` : number;
}

/** "from € 162k": a compact starting price. */
export function formatFrom(amount: number | null, currency: string | null): string {
    if (amount === null) return "";
    const code = (currency ?? "").toUpperCase();
    const symbol = SYMBOLS[code] ?? code;
    const short = amount >= 1000 ? `${Math.round(amount / 1000)}k` : String(Math.round(amount));
    return `${symbol} ${short}`.trim();
}

/** "under_construction" -> "Under construction" when the configured label is not at hand. */
export function humanize(value: string | null): string {
    if (!value) return "";
    const text = value.replace(/[_-]+/g, " ").trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Iskele · Long Beach · 2 bed · 86 m² · CAPITON": where, how big, whose. */
export function propertyLine(property: { city: string | null; area: string | null; bedrooms: number | null; size_sqm: number | null; developer: string | null }, bedLabel: (count: number) => string): string {
    const parts = [
        property.city,
        property.area,
        property.bedrooms !== null ? bedLabel(property.bedrooms) : null,
        property.size_sqm ? `${Math.round(property.size_sqm)} m²` : null,
        property.developer,
    ];
    return parts.filter((part): part is string => Boolean(part)).join(" · ");
}
