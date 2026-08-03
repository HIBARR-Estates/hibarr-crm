import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { formatCurrencyWithSymbol } from "@/lib/utils";

export interface CurrencyDisplay {
    code: string;
    symbol: string;
}

type EntityCurrency =
    | {
          currency_code?: string | null;
          currency_symbol?: string | null;
          code?: string | null;
      }
    | string
    | null
    | undefined;

/** Company/org default currency from shared Inertia props. */
export function companyCurrencyFromPage(props: {
    default_currency_code?: string | null;
    default_currency_symbol?: string | null;
}): CurrencyDisplay {
    const code = props.default_currency_code?.trim() || "";
    const symbol = props.default_currency_symbol?.trim() || code;
    return { code, symbol };
}

/**
 * Prefer the entity currency; if missing, fall back to the company currency.
 */
export function resolveCurrencyDisplay(
    entity: EntityCurrency,
    company?: CurrencyDisplay | null,
): CurrencyDisplay {
    if (typeof entity === "string" && entity.trim()) {
        const code = entity.trim();
        return { code, symbol: code };
    }

    if (entity && typeof entity === "object") {
        const code = (
            entity.currency_code ||
            entity.code ||
            ""
        ).trim();
        const symbol = (entity.currency_symbol || "").trim() || code;
        if (code || symbol) {
            return { code: code || symbol, symbol: symbol || code };
        }
    }

    return {
        code: company?.code || "",
        symbol: company?.symbol || company?.code || "",
    };
}

export function formatMoneyAmount(
    amount: number,
    currency: CurrencyDisplay,
    style: "symbol" | "code" = "symbol",
): string {
    const prefix =
        style === "symbol"
            ? currency.symbol || currency.code
            : currency.code || currency.symbol;

    if (!prefix) {
        return Number(amount).toLocaleString();
    }

    if (style === "symbol") {
        return formatCurrencyWithSymbol(Number(amount), prefix);
    }

    return `${prefix} ${Number(amount).toLocaleString()}`;
}

/** Shared company currency for lead/deal money display on this page. */
export function useCompanyCurrency(): CurrencyDisplay {
    const page = usePage<PageProps>();
    return companyCurrencyFromPage(page.props);
}
