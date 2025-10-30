import React, { useState, useEffect } from "react";
import { Input, Select } from "antd";
import { Country } from "@/Types";

interface Props {
    countries: Country[];
    defaultCountry?: Country | null;
    fieldName: string;
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
}

const PhoneInput: React.FC<Props> = ({
    countries,
    defaultCountry,
    fieldName,
    value = "",
    onChange,
    placeholder = "Enter phone number",
}) => {
    const [selectedCountry, setSelectedCountry] = useState<Country | null>(
        defaultCountry || null
    );
    const [phoneNumber, setPhoneNumber] = useState("");

    // Parse initial value if it's a JSON string from the server
    useEffect(() => {
        if (value) {
            try {
                const phoneData = JSON.parse(value);
                if (phoneData.phone && phoneData.country_identifier) {
                    const country = countries.find(
                        (c) => c.iso === phoneData.country_identifier
                    );
                    if (country) {
                        setSelectedCountry(country);
                        // Extract phone number without country code
                        const cleanPhone = phoneData.phone
                            .replace(`+${phoneData.country_code}`, "")
                            .trim();
                        setPhoneNumber(cleanPhone);
                    }
                }
            } catch {
                // If not JSON, treat as plain phone number
                setPhoneNumber(value);
            }
        }
    }, [value, countries]);

    // Update form value when country or phone changes
    useEffect(() => {
        if (onChange) {
            if (selectedCountry && phoneNumber) {
                const fullPhone = `+${selectedCountry.phonecode} ${phoneNumber}`;
                onChange(fullPhone);
            } else {
                onChange(phoneNumber);
            }
        }
    }, [selectedCountry, phoneNumber, onChange]);

    const handleCountryChange = (countryId: number) => {
        const country = countries.find(
            (c) => c.id?.toString() === countryId.toString()
        );
        setSelectedCountry(country || null);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhoneNumber(e.target.value);
    };

    return (
        <Input.Group compact>
            <Select
                style={{ width: "40%" }}
                placeholder="Country"
                value={selectedCountry?.id}
                onChange={handleCountryChange}
                showSearch
                filterOption={(input, option) => {
                    const country = countries.find(
                        (c) => c.id.toString() === option?.value.toString()
                    );
                    return (
                        country?.nicename
                            .toLowerCase()
                            .includes(input.toLowerCase()) || false
                    );
                }}
                options={countries.map((country) => ({
                    value: country.id,
                    label: `${country.nicename} (+${country.phonecode})`,
                }))}
            />
            <Input
                style={{ width: "60%" }}
                placeholder={placeholder}
                value={phoneNumber}
                onChange={handlePhoneChange}
                addonBefore={
                    selectedCountry ? `+${selectedCountry.phonecode}` : "+"
                }
            />
        </Input.Group>
    );
};

export default PhoneInput;
