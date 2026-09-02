import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealMoneyInputProps {
    /** Raw digits, no separators — "1500", not "1,500". */
    value: string;
    /** Prefix shown inside the field: a currency symbol, or "%" for a rate. */
    prefix: string;
    placeholder?: string;
    disabled?: boolean;
    ariaLabel?: string;
    onChange: (value: string) => void;
}

/** Thousand separators for display only; the caller keeps raw digits. */
function format(raw: string): string {
    if (raw === "") return "";
    const [whole, decimals] = raw.split(".");
    const grouped = Number(whole || 0).toLocaleString("en-GB");
    return decimals === undefined ? grouped : `${grouped}.${decimals}`;
}

/**
 * Money field for amounts already denominated in a known currency.
 *
 * The analysis form's CurrencyInput pairs its amount box with a currency
 * picker, which is right there and wrong here: a deal's discount and deduction
 * are by definition in that deal's currency, so offering a per-field currency
 * would invite amounts that silently disagree with the deal. Same visual
 * treatment as that input's amount half, minus the picker.
 */
export default function DealMoneyInput({
    value,
    prefix,
    placeholder = "0",
    disabled,
    ariaLabel,
    onChange,
}: DealMoneyInputProps) {
    return (
        <div className="relative w-full">
            <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm"
                style={{ color: T.TEXT_MUTED }}
            >
                {prefix}
            </span>
            <input
                type="text"
                inputMode="decimal"
                aria-label={ariaLabel}
                disabled={disabled}
                value={format(value)}
                placeholder={placeholder}
                onChange={(e) =>
                    // One optional decimal point, digits either side.
                    onChange(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm transition-colors placeholder-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-40"
                style={{ color: T.TEXT }}
            />
        </div>
    );
}
