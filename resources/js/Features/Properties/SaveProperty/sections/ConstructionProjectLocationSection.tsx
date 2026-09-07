import React, { useEffect, useMemo, useRef } from "react";
import { Form, Select, Input, InputNumber, Row, Col } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { CityLookupValue, PropertyEnumValues } from "@/Types";
import { DISTANCE_FIELDS } from "../constructionProjectConfig";
import type { DeveloperProject } from "@/Types/developerProject";

const { TextArea } = Input;

/** Fold TR/Cyprus diacritics so "Gazimagusa" still matches "Gazimağusa". */
const foldSearchText = (value: string): string =>
    value
        .replace(/ı/g, "i")
        .replace(/İ/g, "i")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

const filterLocationOption = (
    input: string,
    option?: { label?: React.ReactNode; value?: string | number },
) => {
    const query = foldSearchText(input.trim());
    if (!query) {
        return true;
    }
    const label = foldSearchText(String(option?.label ?? ""));
    const value = foldSearchText(String(option?.value ?? ""));
    return label.includes(query) || value.includes(query);
};

const resolveCityLookup = (
    stored: string | undefined | null,
    cities: CityLookupValue[],
): CityLookupValue | undefined => {
    if (!stored) {
        return undefined;
    }
    const exactName = cities.find((city) => city.name === stored);
    if (exactName) {
        return exactName;
    }
    const exactLabel = cities.find((city) => city.label === stored);
    if (exactLabel) {
        return exactLabel;
    }
    const folded = foldSearchText(stored);
    return cities.find(
        (city) =>
            foldSearchText(city.name) === folded ||
            foldSearchText(city.label) === folded,
    );
};

interface ConstructionProjectLocationSectionProps {
    form: FormInstance;
    enumValues?: PropertyEnumValues;
    /** Kept for call-site compatibility; location hydrate happens in the parent modal. */
    project?: DeveloperProject | null;
}

/**
 * Location section for construction projects.
 *
 * Same as the standard LocationSection but:
 * - Excludes Block Name and Unit Number (project-level, not unit-level)
 * - Includes distance input fields (markets, hospitals, airports, schools, beaches)
 */
const ConstructionProjectLocationSection: React.FC<
    ConstructionProjectLocationSectionProps
> = ({ form, enumValues }) => {
    const selectedCity = Form.useWatch("city", form);
    const previousCityRef = useRef<string | undefined | null>(undefined);
    const hydratedRef = useRef(false);

    const cityOptions = useMemo(() => {
        const cities = enumValues?.cities || [];
        return cities.map((c) => ({
            value: c.name,
            label: c.label,
        }));
    }, [enumValues?.cities]);

    const resolvedCity = useMemo(
        () => resolveCityLookup(selectedCity, enumValues?.cities ?? []),
        [selectedCity, enumValues?.cities],
    );

    const areaOptions = useMemo(() => {
        if (!selectedCity || !enumValues?.areas_by_city) return [];
        const cityKey = resolvedCity?.name ?? selectedCity;
        const areas =
            enumValues.areas_by_city[cityKey] ??
            enumValues.areas_by_city[selectedCity] ??
            [];
        return areas.map((a) => ({
            value: a.name,
            label: a.label,
        }));
    }, [selectedCity, resolvedCity, enumValues?.areas_by_city]);

    // On real user city changes: clear area/address/coords and fill empty distance defaults.
    // Do not re-apply the saved project area (that caused "reset to wrong address").
    useEffect(() => {
        if (!hydratedRef.current) {
            if (selectedCity != null && selectedCity !== "") {
                previousCityRef.current = selectedCity;
                hydratedRef.current = true;
            }
            return;
        }

        if (previousCityRef.current === selectedCity) {
            return;
        }

        previousCityRef.current = selectedCity;

        form.setFieldsValue({
            area: undefined,
            address: undefined,
            latitude: undefined,
            longitude: undefined,
        });

        if (!selectedCity || !enumValues?.cities) return;

        const cityObj = resolveCityLookup(selectedCity, enumValues.cities);
        const defaults = cityObj?.default_distances;
        if (!defaults) return;

        DISTANCE_FIELDS.forEach((field) => {
            const current = form.getFieldValue(["distances", field.key]);
            if (current == null || current === "") {
                const defaultVal = defaults[field.key as keyof typeof defaults];
                if (defaultVal != null) {
                    form.setFieldValue(["distances", field.key], defaultVal);
                }
            }
        });
    }, [selectedCity, enumValues?.cities, form]);

    return (
        <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
                <Form.Item name="city" label="City">
                    <Select
                        options={cityOptions}
                        placeholder="Select city"
                        allowClear
                        showSearch
                        filterOption={filterLocationOption}
                    />
                </Form.Item>
            </Col>

            <Col xs={24} md={12}>
                <Form.Item name="area" label="Area / District">
                    <Select
                        options={areaOptions}
                        placeholder={
                            selectedCity
                                ? "Select area"
                                : "Select city first"
                        }
                        allowClear
                        showSearch
                        filterOption={filterLocationOption}
                        disabled={!selectedCity}
                    />
                </Form.Item>
            </Col>

            <Col span={24}>
                <Form.Item name="address" label="Full Address">
                    <TextArea
                        rows={2}
                        placeholder="Street address or description"
                    />
                </Form.Item>
            </Col>

            <Col xs={12} md={6}>
                <Form.Item
                    name="latitude"
                    label="Latitude"
                    rules={[
                        {
                            type: "number",
                            transform: (v: string) =>
                                v ? Number(v) : undefined,
                        },
                    ]}
                >
                    <InputNumber
                        placeholder="35.1856"
                        style={{ width: "100%" }}
                        step={0.0001}
                    />
                </Form.Item>
            </Col>

            <Col xs={12} md={6}>
                <Form.Item
                    name="longitude"
                    label="Longitude"
                    rules={[
                        {
                            type: "number",
                            transform: (v: string) =>
                                v ? Number(v) : undefined,
                        },
                    ]}
                >
                    <InputNumber
                        placeholder="33.3823"
                        style={{ width: "100%" }}
                        step={0.0001}
                    />
                </Form.Item>
            </Col>

            <Col xs={24} md={12}>
                <Form.Item name="map_url" label="Map URL">
                    <Input placeholder="Google Maps link" />
                </Form.Item>
            </Col>

            <Col span={24}>
                <div className="mt-2 mb-2 border-t pt-3">
                    <span className="text-sm font-medium text-gray-700">
                        Distances (km)
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                        Approximate driving distance
                    </span>
                </div>
            </Col>

            {DISTANCE_FIELDS.map((field) => (
                <Col xs={12} md={8} key={field.key}>
                    <Form.Item
                        name={["distances", field.key]}
                        label={field.label}
                    >
                        <InputNumber
                            min={0}
                            max={500}
                            step={0.1}
                            placeholder="km"
                            style={{ width: "100%" }}
                            addonAfter="km"
                        />
                    </Form.Item>
                </Col>
            ))}
        </Row>
    );
};

export default ConstructionProjectLocationSection;
