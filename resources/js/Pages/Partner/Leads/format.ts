import type { CurrencyRef } from "./types";

/** 12,400.00 in the deal's own currency; falls back to a plain symbol prefix. */
export function money(amount: number, currency: CurrencyRef): string {
    if (currency.code) {
        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: currency.code,
            }).format(amount);
        } catch {
            // Unknown code: fall through to the plain form.
        }
    }

    return `${currency.symbol ?? ""}${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}
