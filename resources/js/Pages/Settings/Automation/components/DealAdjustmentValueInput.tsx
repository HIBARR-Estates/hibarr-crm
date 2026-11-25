import Segmented from "@/Components/Redesign/primitives/Segmented";
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
    const currency = useCompanyCurrency();
    const symbol = currency.symbol || currency.code || "";

    const isDiscount = fieldName === "discount_value";
    const { mode, amount } = isDiscount ? parseDiscountValue(value) : { mode: "fixed" as const, amount: value ?? "" };

    const emit = (nextMode: "percent" | "fixed", nextAmount: string) => {
        if (nextAmount === "") return onChange(null);
        onChange(isDiscount ? formatDiscountValue(nextMode, nextAmount) : nextAmount);
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
                    step="0.01"
                    value={amount}
                    onChange={(e) => emit(mode, e.target.value)}
                    className="dr-input"
                    style={{ flex: 1, minWidth: 0 }}
                    placeholder="0.00"
                />
            </div>
            {!(isDiscount && mode === "percent") && (
                <span style={{ fontSize: 11, opacity: 0.7 }}>Applied in each deal's own currency.</span>
            )}
        </div>
    );
}
