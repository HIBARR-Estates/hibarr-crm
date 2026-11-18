import { useRef } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import {
    parsePastedAmount,
    regroupTypedComma,
    sanitizeAmount,
} from "../../adapters/moneyInput";

interface DealMoneyInputProps {
    /** Raw digits, no separators — "1500", not "1,500". */
    value: string;
    /** Prefix shown inside the field: a currency symbol, or "%" for a rate. */
    prefix: string;
    placeholder?: string;
    disabled?: boolean;
    ariaLabel?: string;
    onChange: (value: string) => void;
    /**
     * A pasted amount that cannot be read without guessing (e.g. "1,2,3") is
     * ignored and the field keeps its value; this tells the caller so it can say so.
     */
    onInvalidPaste?: () => void;
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
    onInvalidPaste,
}: DealMoneyInputProps) {
    // True while the decimal point in the value was typed as a comma.
    const commaTyped = useRef(false);

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
                onChange={(e) => {
                    let text = e.target.value;
                    const native = e.nativeEvent as InputEvent;

                    // Grouping commas are only ever drawn by format(), never typed, so a
                    // typed comma is a decimal separator ("12,50"), not something to drop.
                    if (native.inputType === "insertText" && native.data === ",") {
                        const at = (e.target.selectionStart ?? text.length) - 1;
                        if (text[at] === ",") {
                            text = `${text.slice(0, at)}.${text.slice(at + 1)}`;
                            commaTyped.current = true;
                        }
                    }

                    // One optional decimal point, digits either side. "1,500" typed reads
                    // as 1500, the same as pasted; "12,50" stays 12.50.
                    const next = regroupTypedComma(sanitizeAmount(text), commaTyped.current);
                    if (!next.includes(".")) {
                        commaTyped.current = false;
                    }
                    onChange(next);
                }}
                onPaste={(e) => {
                    e.preventDefault();
                    commaTyped.current = false;
                    const pasted = parsePastedAmount(e.clipboardData.getData("text"));

                    if (pasted === null) {
                        onInvalidPaste?.();
                        return;
                    }

                    // The selection is in the grouped text; map it back to raw characters.
                    const shown = format(value);
                    const rawIndex = (position: number | null) =>
                        shown.slice(0, position ?? shown.length).replace(/,/g, "").length;
                    const start = rawIndex(e.currentTarget.selectionStart);
                    const end = rawIndex(e.currentTarget.selectionEnd);

                    onChange(sanitizeAmount(value.slice(0, start) + pasted + value.slice(end)));
                }}
                className="h-10 w-full rounded-xl border border-dr-border bg-white pl-8 pr-3 text-sm transition-colors placeholder-dr-text-hint focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-40"
                style={{ color: T.TEXT }}
            />
        </div>
    );
}
