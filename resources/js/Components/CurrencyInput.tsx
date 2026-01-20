import React, { useState, useEffect } from "react";
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
    placeholder = "Enter the Amount in Numbers",
    showLabel = false,
    label = "Amount",
    optional = false,
    disabled = false,
    noFormItem = false,
}) => {
    const { props } = usePage<any>();
    const { currencies = [] } = props;

    const [currencyData, setCurrencyData] = useState<CurrencyData>({
        amount: null,
        currency: "USD",
    });

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
        return ["USD", "EUR", "GBP"];
    };

    // Parse value prop (from Form.Item or parent)
    useEffect(() => {
        if (value !== undefined) {
            let parsedData: CurrencyData | null = null;

            // If value is null/undefined, reset
            if (value === null || value === undefined) {
                setCurrencyData({
                    amount: null,
                    currency: "USD",
                });
                return;
            }

            try {
                // Try to parse as JSON string first
                if (typeof value === "string") {
                    parsedData = JSON.parse(value);
                } else if (typeof value === "object" && (value.amount !== undefined || value.currency)) {
                    parsedData = value;
                }
            } catch {
                // If not JSON and not object, treat as plain number
                if (typeof value === "string" && !isNaN(Number(value))) {
                    setCurrencyData({
                        amount: value,
                        currency: "USD", // default
                    });
                    return;
                } else if (typeof value === "number") {
                    setCurrencyData({
                        amount: value,
                        currency: "USD", // default
                    });
                    return;
                }
            }

            if (parsedData) {
                setCurrencyData({
                    amount: parsedData.amount ?? null,
                    currency: parsedData.currency || "USD",
                });
            }
        }
    }, [value]);

    // Update form value when currency data changes
    // Note: We don't call onChange here to avoid infinite loops
    // onChange is handled directly in handleAmountChange and handleCurrencyChange

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
            setCurrencyData(newData);
            
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
        setCurrencyData(newData);
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
                    bordered={false}
                    style={{ width: 90 }}
                    dropdownMatchSelectWidth={false}
                    disabled={disabled}
                />
            }
            controls={false}
            stringMode={true}
            formatter={formatter}
            parser={parser}
            onChange={handleAmountChange}
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
