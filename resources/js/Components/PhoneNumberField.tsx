import { useState, type KeyboardEvent } from "react";
import PhoneInput, { type PhoneNumber } from "antd-phone-input";
import { normalizePastedPhoneNumber, serializePhoneInputValue } from "@/lib/utils";

export type PhoneCountryOption = {
    iso?: string | null;
    phonecode?: string | number | null;
};

/** Picks the flag for a stored "+<code>…" number; empty lets the input use its own default. */
export function resolvePhoneCountryIso(phoneStr: string, countries: PhoneCountryOption[]): string {
    if (!phoneStr?.startsWith("+")) return "";

    const phoneWithoutPlus = phoneStr.substring(1);
    for (let len = 4; len >= 1; len--) {
        const potentialCode = phoneWithoutPlus.substring(0, len);
        const matchingCountry = countries.find(
            (country) =>
                country.phonecode?.toString() === potentialCode ||
                country.phonecode === parseInt(potentialCode, 10),
        );
        if (matchingCountry?.iso) {
            return matchingCountry.iso.toLowerCase();
        }
    }

    // Empty → PhoneInput keeps its timezone default. Never force "af":
    // that short mask truncates many international pastes.
    return "";
}

export interface PhoneNumberFieldProps {
    value: string | PhoneNumber | undefined;
    countries: PhoneCountryOption[];
    /** Receives "+<country><number>", the same string the lead page saves. */
    onValueChange: (value: string) => void;
    id?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    onBlur?: () => void;
    onKeyDown?: (e: KeyboardEvent) => void;
}

/**
 * The lead page's phone editor (flag + searchable dial code + masked number).
 * Remounts after an international paste so antd-phone-input re-initializes
 * with the full number; its active-country mask otherwise clips pasted digits
 * that don't fit (often the last 1–2 digits).
 */
export default function PhoneNumberField({
    value,
    countries,
    onValueChange,
    id,
    placeholder,
    disabled,
    className = "flex-1",
    onBlur,
    onKeyDown,
}: PhoneNumberFieldProps) {
    const [remountKey, setRemountKey] = useState(0);
    const stringValue = typeof value === "string" ? value : "";
    const countryProp = resolvePhoneCountryIso(stringValue, countries);

    return (
        <PhoneInput
            key={remountKey}
            id={id}
            value={value}
            onChange={(val) => {
                if (val && typeof val === "object" && "phoneNumber" in val) {
                    onValueChange(serializePhoneInputValue(val, value));
                } else if (typeof val === "string") {
                    onValueChange(val);
                } else {
                    onValueChange(val as unknown as string);
                }
            }}
            onPaste={(event) => {
                const pasted = event.clipboardData?.getData("text") ?? "";
                const normalized = normalizePastedPhoneNumber(pasted);
                if (!normalized) return;

                // International / long pastes: bypass the active mask entirely.
                const pastedDigits = pasted.replace(/\D/g, "");
                const trimmedPaste = pasted.trim();
                const looksInternational =
                    trimmedPaste.startsWith("+") ||
                    trimmedPaste.startsWith("00") ||
                    (pastedDigits.length >= 11 && !pastedDigits.startsWith("0"));
                if (!looksInternational) return;

                event.preventDefault();
                event.stopPropagation();
                onValueChange(normalized);
                setRemountKey((key) => key + 1);
            }}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={className}
            disabled={disabled}
            enableSearch
            allowClear
            {...(countryProp ? { country: countryProp } : {})}
        />
    );
}
