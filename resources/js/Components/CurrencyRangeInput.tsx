import React from "react";
import { InputNumber, Select } from "antd";
import { usePage } from "@inertiajs/react";
import { useCurrencies } from "@/Hooks/useFormData";
import { parseCurrencyRangeValue } from "@/lib/utils";

interface Props {
    value?: any;
    onChange?: (value: {
        min: number | null;
        max: number | null;
        currency: string;
    }) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * Two amount inputs sharing one currency selector — a "currency range"
 * field (e.g. a budget range), combining RangeInput's dual-value shape with
 * CurrencyInput's currency picker.
 */
const CurrencyRangeInput: React.FC<Props> = ({
    value,
    onChange,
    placeholder,
    disabled = false,
}) => {
    const { props } = usePage<any>();
    const { currencies } = useCurrencies();
    const defaultCurrencyCode = props.default_currency_code || "TRY";
    const parsed = parseCurrencyRangeValue(value, defaultCurrencyCode);

    const availableCurrencies =
        currencies.length > 0
            ? currencies
                  .map(
                      (c: any) => c.currency_code || c.currency_name?.toUpperCase(),
                  )
                  .filter(Boolean)
            : [defaultCurrencyCode];

    const emit = (min: number | null, max: number | null, currency: string) => {
        onChange?.({ min, max, currency });
    };

    return (
        <div className="flex items-center gap-2">
            <InputNumber
                value={parsed.min ?? undefined}
                min={0}
                placeholder={placeholder ? `Min ${placeholder}` : "Min"}
                disabled={disabled}
                style={{ width: "100%" }}
                onChange={(val) =>
                    emit(val === null ? null : Number(val), parsed.max, parsed.currency)
                }
            />
            <span className="text-gray-400">–</span>
            <InputNumber
                value={parsed.max ?? undefined}
                min={0}
                placeholder={placeholder ? `Max ${placeholder}` : "Max"}
                disabled={disabled}
                style={{ width: "100%" }}
                onChange={(val) =>
                    emit(parsed.min, val === null ? null : Number(val), parsed.currency)
                }
            />
            <Select
                value={parsed.currency}
                onChange={(currency) => emit(parsed.min, parsed.max, currency)}
                options={availableCurrencies.map((code: string) => ({
                    value: code,
                    label: code,
                }))}
                disabled={disabled}
                popupMatchSelectWidth={false}
                style={{ minWidth: 72 }}
            />
        </div>
    );
};

export default CurrencyRangeInput;
