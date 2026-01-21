import React, { useState, useEffect, useMemo, useRef } from "react";
import { InputNumber, Select, Form } from "antd";
import { usePage } from "@inertiajs/react";

// Currency type that may come from different sources
type CurrencyType = {
    id?: number;
    currency_name?: string;
    currency_symbol?: string;
    currency_code?: string;
    [key: string]: any;
};

interface Props {
    fieldName?: string;
    value?: string | any;
    onChange?: (value: any) => void;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
    placeholder?: string;
    showLabel?: boolean;
    label?: string;
    optional?: boolean;
    disabled?: boolean;
    noFormItem?: boolean; // When true, don't wrap with Form.Item (for use in CustomFieldRenderer)
}

interface CurrencyData {
    amount: string | number | null;
    currency: string;
}

const CurrencyInput: React.FC<Props> = ({
    fieldName,
    value,
    onChange,
    onBlur,
    onKeyDown,
    placeholder = "Enter the Amount in Numbers",
    showLabel = false,
    label = "Amount",
    optional = false,
    disabled = false,
    noFormItem = false,
}) => {
    const { props } = usePage<any>();
    const { currencies = [], default_currency_code } = props;
    const effectiveDefaultCurrencyCode = default_currency_code || "TRY";

    // Use useMemo to stabilize the default currency code
    const stableDefaultCurrency = useMemo(() => effectiveDefaultCurrencyCode, [effectiveDefaultCurrencyCode]);

    // Parse value prop directly in render (no useEffect to avoid loops)
    const parsedValue = useMemo((): CurrencyData => {
        if (value === null || value === undefined) {
            return { amount: null, currency: stableDefaultCurrency };
        }

        if (typeof value === "number") {
            return { amount: value, currency: stableDefaultCurrency };
        }

        if (typeof value === "string" && !isNaN(Number(value)) && value.trim() !== "") {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                return { amount: numValue, currency: stableDefaultCurrency };
            }
        }

        let parsedData: CurrencyData | null = null;
        try {
            if (typeof value === "string") {
                const parsed = JSON.parse(value);
                if (typeof parsed === "number") {
                    return { amount: parsed, currency: stableDefaultCurrency };
                }
                if (typeof parsed === "object" && parsed !== null) {
                    parsedData = parsed;
                }
            } else if (typeof value === "object" && value !== null) {
                if ((value as any).amount !== undefined || (value as any).currency !== undefined) {
                    parsedData = value as CurrencyData;
                }
            }
        } catch {
            // ignore
        }

        if (parsedData && (parsedData.amount !== undefined || parsedData.currency !== undefined)) {
            return {
                amount: (parsedData as any).amount ?? null,
                currency: (parsedData as any).currency || stableDefaultCurrency,
            };
        }

        return { amount: null, currency: stableDefaultCurrency };
    }, [value, stableDefaultCurrency]);

    // Internal state only for uncontrolled mode or when value is undefined
    const [internalCurrencyData, setInternalCurrencyData] = useState<CurrencyData>(parsedValue);

    // Use parsed value if provided, otherwise use internal state
    const currencyData = value !== undefined ? parsedValue : internalCurrencyData;

    // Default currency symbols if currencies array is empty
    const defaultSymbols: Record<string, string> = {
        USD: "$",
        EUR: "€",
        GBP: "£",
    };

    // Get currency symbol
    const getCurrencySymbol = (currencyCode: string): string => {
        if (currencies.length > 0) {
            const currency = currencies.find(
                (c: CurrencyType) => 
                    c.currency_code === currencyCode || 
                    c.currency_name?.toUpperCase() === currencyCode.toUpperCase()
            );
            return currency?.currency_symbol || defaultSymbols[currencyCode] || "";
        }
        return defaultSymbols[currencyCode] || "";
    };

    // Get available currency codes
    const getAvailableCurrencies = (): string[] => {
        if (currencies.length > 0) {
            return currencies
                .map((c: CurrencyType) => c.currency_code || c.currency_name?.toUpperCase())
                .filter((code: string | undefined): code is string => !!code);
        }
        return [default_currency_code, "EUR", "GBP"].filter(Boolean);
    };

    // Update internal state when parsed value changes (only for uncontrolled mode)
    // Use ref to track previous value to prevent unnecessary updates
    const previousParsedValueRef = useRef<string | null>(null);
    
    useEffect(() => {
        if (value === undefined) {
            // Create a stable key for comparison
            const parsedKey = JSON.stringify(parsedValue);
            
            // Skip if value hasn't actually changed
            if (previousParsedValueRef.current === parsedKey) {
                return;
            }
            
            previousParsedValueRef.current = parsedKey;
            setInternalCurrencyData(parsedValue);
        } else {
            // Reset when switching to controlled mode
            previousParsedValueRef.current = null;
        }
    }, [parsedValue, value]);

    const handleAmountChange = (amount: string | number | null) => {
        try {
            // Normalize the amount value
            let normalizedAmount: string | number | null = amount;
            
            // If it's a string, ensure it's valid
            if (typeof amount === "string") {
                // Remove commas and check if it's a valid number
                const cleaned = amount.replace(/,/g, "");
                if (cleaned === "" || cleaned === ".") {
                    normalizedAmount = null;
                } else if (!isNaN(Number(cleaned))) {
                    normalizedAmount = cleaned;
                } else {
                    // Invalid input, keep previous value
                    return;
                }
            }
            
            const newData = { ...currencyData, amount: normalizedAmount };
            
            // Update internal state only if uncontrolled
            if (value === undefined) {
                setInternalCurrencyData(newData);
            }
            
            if (onChange) {
                if (normalizedAmount !== null && normalizedAmount !== "") {
                    onChange({
                        amount: normalizedAmount,
                        currency: newData.currency,
                    });
                } else {
                    onChange(null);
                }
            }
        } catch (error) {
            console.error("Error handling amount change:", error);
        }
    };

    const handleCurrencyChange = (currency: string) => {
        const newData = { ...currencyData, currency };
        
        // Update internal state only if uncontrolled
        if (value === undefined) {
            setInternalCurrencyData(newData);
        }
        
        if (onChange) {
            if (newData.amount !== null && newData.amount !== "") {
                onChange({
                    amount: newData.amount,
                    currency: newData.currency,
                });
            } else {
                onChange(null);
            }
        }
    };

    const availableCurrencies = getAvailableCurrencies();
    const symbol = getCurrencySymbol(currencyData.currency);

    // Format number with commas - only allow numeric input
    const formatter = (val: string | number | undefined | null): string => {
        if (val === undefined || val === null || val === "") return "";
        
        try {
            const valStr = String(val);
            // Remove all non-numeric characters except decimal point
            let numericString = valStr.replace(/[^\d.]/g, "");
            if (!numericString) return "";
            
            // Split into integer and decimal parts
            const parts = numericString.split(".");
            let intPart = parts[0] || "";
            let decPart = parts[1] || "";
            
            // Limit to 2 decimal places
            if (decPart.length > 2) {
                decPart = decPart.substring(0, 2);
            }
            
            // Add commas to integer part
            const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            
            return decPart ? `${withCommas}.${decPart}` : withCommas;
        } catch (error) {
            console.error("Formatter error:", error);
            return "";
        }
    };

    // Parse number by removing commas and non-numeric characters
    const parser = (val: string | undefined): string => {
        if (!val) return "";
        
        try {
            // Remove commas and any non-numeric characters except decimal point
            let cleaned = val.replace(/,/g, "").replace(/[^\d.]/g, "");
            
            // Ensure only one decimal point
            const parts = cleaned.split(".");
            if (parts.length > 2) {
                cleaned = parts[0] + "." + parts.slice(1).join("");
            }
            
            return cleaned;
        } catch (error) {
            console.error("Parser error:", error);
            return "";
        }
    };

    // Prevent non-numeric characters from being typed
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const char = e.key;
        // Allow: digits (0-9), decimal point (.), backspace, delete, tab, escape, enter, arrow keys
        const allowedKeys = [
            "Backspace", "Delete", "Tab", "Escape", "Enter",
            "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
            "Home", "End"
        ];
        
        // Allow control keys (Ctrl, Alt, Meta)
        if (e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }
        
        // Allow allowed keys
        if (allowedKeys.includes(char)) {
            return;
        }
        
        // Allow digits
        if (/^\d$/.test(char)) {
            return;
        }
        
        // Allow single decimal point only if one doesn't already exist
        if (char === ".") {
            const currentValue = String(currencyData.amount || "");
            if (currentValue.includes(".")) {
                e.preventDefault();
                return;
            }
            return;
        }
        
        // Prevent all other characters
        e.preventDefault();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Allow parent (EditableField) to handle Enter/Escape save/cancel
        if (onKeyDown) {
            onKeyDown(e);
        }
        // Keep our numeric restrictions
        handleKeyPress(e);
    };

    const inputComponent = (
        <InputNumber
            value={currencyData.amount}
            placeholder={placeholder}
            prefix={symbol}
            addonAfter={
                <Select
                    value={currencyData.currency}
                    onChange={handleCurrencyChange}
                    options={availableCurrencies.map((code) => ({
                        value: code,
                        label: code,
                    }))}
                    variant="borderless"
                    popupMatchSelectWidth={false}
                    disabled={disabled}
                />
            }
            controls={false}
            stringMode={true}
            formatter={formatter}
            parser={parser}
            onChange={handleAmountChange}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            min={0}
            step="0.01"
        />
    );

    if (noFormItem) {
        return inputComponent;
    }

    return (
        <Form.Item name={fieldName} label={showLabel ? label : undefined}>
            {inputComponent}
        </Form.Item>
    );
};

export default CurrencyInput;
