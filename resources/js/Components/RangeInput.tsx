import React from "react";
import { InputNumber } from "antd";
import { parseRangeValue } from "@/lib/utils";

interface Props {
    value?: any;
    onChange?: (value: { min: number | null; max: number | null }) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * Two-input "range" custom field (e.g. a budget min–max), mirroring
 * CurrencyInput's shape: a single value/onChange pair so antd's Form.Item
 * can wire it up the same way, but emitting {min,max} instead of
 * {amount,currency}.
 */
const RangeInput: React.FC<Props> = ({
    value,
    onChange,
    placeholder,
    disabled = false,
}) => {
    const parsed = parseRangeValue(value);

    const emit = (min: number | null, max: number | null) => {
        onChange?.({ min, max });
    };

    return (
        <div className="flex items-center gap-2">
            <InputNumber
                value={parsed.min ?? undefined}
                min={0}
                placeholder={placeholder ? `Min ${placeholder}` : "Min"}
                disabled={disabled}
                style={{ width: "100%" }}
                onChange={(val) => emit(val === null ? null : Number(val), parsed.max)}
            />
            <span className="text-gray-400">–</span>
            <InputNumber
                value={parsed.max ?? undefined}
                min={0}
                placeholder={placeholder ? `Max ${placeholder}` : "Max"}
                disabled={disabled}
                style={{ width: "100%" }}
                onChange={(val) => emit(parsed.min, val === null ? null : Number(val))}
            />
        </div>
    );
};

export default RangeInput;
