import Segmented from "@/Components/Redesign/primitives/Segmented";
import useTranslation from "@/Hooks/useTranslation";
import { useCompanyCurrency } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import { parseDiscountValue, formatDiscountValue } from "../config/builderFields";

interface Props {
    fieldName: "discount_value" | "deduction_amount";
    value: string | null;
    onChange: (value: string | null) => void;
}

/**
 * Value input for the deal value-card adjustments, laid out like the deal
 * value editor: a discount is a Percent / Fixed switch plus a number with a
 * "%" or currency prefix; a deduction is a number with a currency prefix.
 * A fixed amount is applied in each deal's own currency — the prefix shown
 * here is only the company default.
 */
export default function DealAdjustmentValueInput({ fieldName, value, onChange }: Props) {
    const { t } = useTranslation();
    const currency = useCompanyCurrency();
    const symbol = currency.symbol || currency.code || "";

    const isDiscount = fieldName === "discount_value";
    const { mode, amount } = isDiscount ? parseDiscountValue(value) : { mode: "fixed" as const, amount: value ?? "" };

    // Same limits the server enforces: no negatives, and a percentage tops out
    // at 100. Out-of-range input is clamped rather than saved.
    const emit = (nextMode: "percent" | "fixed", nextAmount: string) => {
        if (nextAmount === "") return onChange(null);
        let n = Number(nextAmount);
        if (!Number.isFinite(n)) return;
        n = Math.max(0, n);
        if (isDiscount && nextMode === "percent") n = Math.min(100, n);
        const clamped = n === Number(nextAmount) ? nextAmount : String(n);
        onChange(isDiscount ? formatDiscountValue(nextMode, clamped) : clamped);
    };

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                {isDiscount ? (
                    <div style={{ flexShrink: 0 }}>
                        <Segmented<"percent" | "fixed">
                            value={mode}
                            onChange={(m) => emit(m, amount)}
                            options={[
                                { value: "percent", label: "%" },
                                { value: "fixed", label: symbol || "Fixed" },
                            ]}
                            ariaLabel="Discount type"
                        />
                    </div>
                ) : (
                    <span style={{ flexShrink: 0 }}>{symbol}</span>
                )}
                <input
                    type="number"
                    min={0}
                    max={isDiscount && mode === "percent" ? 100 : undefined}
                    step="0.01"
                    value={amount}
                    onChange={(e) => emit(mode, e.target.value)}
                    className="dr-input"
                    style={{ flex: 1, minWidth: 0 }}
                    placeholder="0.00"
                />
            </div>
            {!(isDiscount && mode === "percent") && (
                <span style={{ fontSize: 11, opacity: 0.7 }}>{t("app.automation.adjustmentCurrencyHint")}</span>
            )}
        </div>
    );
}
