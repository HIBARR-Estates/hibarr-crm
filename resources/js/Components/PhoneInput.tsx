import React, { useState, useEffect } from "react";
import { Input, Select, Form, Space } from "antd";
import { Country } from "@/Types";
import { useCountries } from "@/Hooks/useFormData";

interface Props {
    fieldName: string;
    value?: string | any;
    onChange?: (value: any) => void;
    placeholder?: string;
    showLabel?: boolean;
    label?: string;
    optional?: boolean;
    disabled?: boolean;
}

interface PhoneData {
    phone: string;
    country_code: string;
    country_identifier: string;
}

const PhoneInput: React.FC<Props> = ({
    fieldName,
    value,
    onChange,
    placeholder = "Enter phone number",
    showLabel = false,
    label = "Phone Number",
    optional = false,
    disabled = false,
}) => {
    const { countries } = useCountries();

    const [searchedCountries, setSearchedCountries] = useState<Country[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<Country | null>(
        null
    );
    const [phoneNumber, setPhoneNumber] = useState("");

    // Handle country search functionality
    const handleCountrySearch = (searchValue: string) => {
        if (searchValue.length > 0) {
            const filteredCountries = countries.filter(
                (country) =>
                    country.nicename
                        .toLowerCase()
                        .includes(searchValue.toLowerCase()) ||
                    country.name
                        .toLowerCase()
                        .includes(searchValue.toLowerCase()) ||
                    country.iso
                        .toLowerCase()
                        .includes(searchValue.toLowerCase()) ||
                    `+${country.phonecode}`.includes(searchValue) ||
                    country.phonecode.toString().includes(searchValue)
            );
            setSearchedCountries(filteredCountries);
        } else {
            setSearchedCountries([]);
        }
    };

    // Parse initial value if it's provided
    useEffect(() => {
        if (value && countries.length > 0) {
            let phoneData: PhoneData | null = null;

            try {
                // Try to parse as JSON string first
                if (typeof value === "string") {
                    phoneData = JSON.parse(value);
                } else if (typeof value === "object" && value.phone) {
                    phoneData = value;
                }
            } catch {
                // If not JSON, treat as plain phone number
                if (typeof value === "string") {
                    setPhoneNumber(value);
                    return;
                }
            }

            if (phoneData) {
                // Find country by country_identifier first
                let country = countries.find(
                    (c) =>
                        c.nicename === phoneData!.country_identifier ||
                        c.name === phoneData!.country_identifier ||
                        c.iso === phoneData!.country_identifier
                );

                // If not found, try by country_code
                if (!country && phoneData.country_code) {
                    country = countries.find(
                        (c) =>
                            c.phonecode.toString() === phoneData!.country_code
                    );
                }

                if (country) {
                    setSelectedCountry(country);
                    // Extract phone number without country code
                    const cleanPhone = phoneData.phone
                        .replace(`+${phoneData.country_code}`, "")
                        .trim();
                    setPhoneNumber(cleanPhone);
                }
            }
        }
    }, [value, countries]);

    // Update form value when country or phone changes
    useEffect(() => {
        if (onChange) {
            if (selectedCountry && phoneNumber) {
                const phoneData: PhoneData = {
                    phone: `+${selectedCountry.phonecode}${phoneNumber}`,
                    country_code: selectedCountry.phonecode.toString(),
                    country_identifier: selectedCountry.nicename,
                };
                onChange(phoneData);
            } else if (phoneNumber && !selectedCountry) {
                // Just return plain number if no country selected
                onChange(phoneNumber);
            } else {
                onChange(null);
            }
        }
    }, [selectedCountry, phoneNumber, onChange]);

    const handleCountryChange = (countryCode: string) => {
        const country = countries.find(
            (c) => c.phonecode.toString() === countryCode
        );
        setSelectedCountry(country || null);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Only allow numeric input
        const numericValue = e.target.value.replace(/[^0-9]/g, "");
        setPhoneNumber(numericValue);
    };

    const mainCountries =
        searchedCountries.length > 0 ? searchedCountries : countries;

    // Helper function to render flag with fallback
    const renderFlag = (country: any, size = 14) => {
        return (
            <span
                className={`flag-icon flag-icon-${country.iso.toLowerCase()}`}
                style={{
                    fontSize: `${size}px`,
                    lineHeight: 1,
                    width: `${size + 2}px`,
                    display: "inline-block",
                }}
                title={country.nicename}
            >
                {/* Fallback if flag-icon CSS is not loaded */}
                <span style={{ fontSize: "10px", opacity: 0.7 }}>
                    {country.iso.toUpperCase()}
                </span>
            </span>
        );
    };

    if (countries.length === 0) {
        return null;
    }

    return (
        <Form.Item name={fieldName} label={showLabel ? label : undefined}>
            <Space.Compact
                style={{
                    width: "100%",
                    display: "flex",
                }}
            >
                <Form.Item
                    noStyle
                    rules={
                        optional
                            ? []
                            : [
                                  {
                                      required: true,
                                      message: "Please select country code",
                                  },
                              ]
                    }
                    name={[fieldName, "country_code"]}
                >
                    <Select
                        style={{ width: "20%" }}
                        placeholder="🌍"
                        value={selectedCountry?.phonecode.toString()}
                        onChange={handleCountryChange}
                        showSearch
                        allowClear
                        disabled={disabled}
                        onClear={() => {
                            setSearchedCountries([]);
                            setSelectedCountry(null);
                        }}
                        onSearch={handleCountrySearch}
                        defaultActiveFirstOption={false}
                        showArrow={false}
                        filterOption={false}
                        optionLabelProp="label"
                        options={mainCountries
                            ?.sort(
                                (a, b) =>
                                    Number(a.phonecode) - Number(b.phonecode)
                            )
                            ?.map((country) => ({
                                value: country.id,
                                label: (
                                    <span
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            fontSize: "12px",
                                        }}
                                    >
                                        {renderFlag(country, 12)}
                                        <span style={{ fontWeight: 500 }}>
                                            +{country.phonecode}
                                        </span>
                                    </span>
                                ),
                                children: (
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "4px 0",
                                        }}
                                    >
                                        {renderFlag(country, 16)}
                                        <span style={{ flex: 1 }}>
                                            {country.nicename}
                                        </span>
                                        <span
                                            style={{
                                                color: "#666",
                                                fontSize: "12px",
                                                fontFamily: "monospace",
                                            }}
                                        >
                                            +{country.phonecode}
                                        </span>
                                    </div>
                                ),
                            }))}
                    />
                </Form.Item>
                <Form.Item
                    noStyle
                    rules={
                        optional
                            ? []
                            : [
                                  {
                                      required: true,
                                      message: "Please enter phone number",
                                  },
                                  {
                                      pattern: /^\d+$/,
                                      message:
                                          "Please enter a valid phone number",
                                  },
                              ]
                    }
                    name={[fieldName, "number"]}
                >
                    <Input
                        style={{ width: "80%" }}
                        placeholder={placeholder}
                        value={phoneNumber}
                        onChange={handlePhoneChange}
                        disabled={disabled}
                        onKeyDown={(e) => {
                            // Allow: backspace, delete, tab, escape, enter, arrows
                            if (
                                [8, 9, 27, 13, 46, 37, 38, 39, 40].includes(
                                    e.keyCode
                                ) ||
                                // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                                (e.ctrlKey &&
                                    [65, 67, 86, 88].includes(e.keyCode))
                            ) {
                                return;
                            }
                            // Ensure that it is a number
                            if (
                                (e.shiftKey ||
                                    e.keyCode < 48 ||
                                    e.keyCode > 57) &&
                                (e.keyCode < 96 || e.keyCode > 105)
                            ) {
                                e.preventDefault();
                            }
                        }}
                    />
                </Form.Item>
            </Space.Compact>
        </Form.Item>
    );
};

export default PhoneInput;
