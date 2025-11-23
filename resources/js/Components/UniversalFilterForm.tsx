import React, { useEffect } from "react";
import {
    Input,
    Select,
    DatePicker,
    InputNumber,
    Row,
    Col,
    Typography,
    Divider,
    Form,
} from "antd";
import { useFilter, FilterConfig } from "@/contexts/FilterContext";
import { usePage } from "@inertiajs/react";
import dayjs from "dayjs";

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface UniversalFilterFormProps {
    config: FilterConfig;
}

const UniversalFilterForm: React.FC<UniversalFilterFormProps> = ({
    config,
}) => {
    const { filters, setFilter, setConfig } = useFilter();
    const { props } = usePage<any>();

    // Initialize config when component mounts
    // useEffect(() => {
    //     setConfig(config);
    // }, [config, ]);

    const renderField = (fieldConfig: any) => {
        const {
            key,
            label,
            type,
            placeholder,
            options,
            dependsOn,
            filterOptions,
        } = fieldConfig;
        const value = filters[key];

        // Handle dependent options
        let fieldOptions = options;
        if (dependsOn && filterOptions) {
            const dependentValue = filters[dependsOn];
            fieldOptions = dependentValue ? filterOptions(dependentValue) : [];
        } else if (typeof options === "function") {
            fieldOptions = options();
        }

        // Get options from props if they exist
        const propsKey = `${key.replace("_id", "")}s`; // Convert lead_pipeline_id to leadPipelines
        const propsOptions = props[propsKey] || props[key] || [];

        if (type === "text") {
            return (
                <Input.Search
                    placeholder={
                        placeholder || `Search ${label.toLowerCase()}...`
                    }
                    value={value || ""}
                    onChange={(e) => setFilter(key, e.target.value)}
                    allowClear
                />
            );
        }

        if (type === "select") {
            const selectOptions = fieldOptions || propsOptions;

            return (
                <Select
                    value={value || undefined}
                    onChange={(val) => {
                        // Find the selected option to get its label
                        const selectedOption = selectOptions.find(
                            (opt: any) => opt.value === val || opt.id === val
                        );
                        const displayValue =
                            selectedOption?.label ||
                            selectedOption?.name ||
                            String(val);
                        setFilter(key, val, label, displayValue);
                    }}
                    placeholder={placeholder || `Select ${label.toLowerCase()}`}
                    style={{ width: "100%" }}
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                        (option?.children as unknown as string)
                            ?.toLowerCase()
                            .includes(input.toLowerCase())
                    }
                >
                    {selectOptions.map((option: any) => (
                        <Option
                            key={option.value || option.id}
                            value={option.value || option.id}
                        >
                            {option.label || option.name}
                        </Option>
                    ))}
                </Select>
            );
        }

        if (type === "multiselect") {
            const selectOptions = fieldOptions || propsOptions;

            return (
                <Select
                    mode="multiple"
                    value={value || []}
                    onChange={(val) => {
                        // Find the selected options to create display value
                        const selectedOptions = selectOptions.filter(
                            (opt: any) => val.includes(opt.value || opt.id)
                        );
                        const displayValue = selectedOptions
                            .map((opt: any) => opt.label || opt.name)
                            .join(", ");
                        setFilter(key, val, label, displayValue);
                    }}
                    placeholder={placeholder || `Select ${label.toLowerCase()}`}
                    style={{ width: "100%" }}
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                        (option?.children as unknown as string)
                            ?.toLowerCase()
                            .includes(input.toLowerCase())
                    }
                >
                    {selectOptions.map((option: any) => (
                        <Option
                            key={option.value || option.id}
                            value={option.value || option.id}
                        >
                            {option.label || option.name}
                        </Option>
                    ))}
                </Select>
            );
        }

        if (type === "date") {
            return (
                <DatePicker
                    value={value ? dayjs(value) : null}
                    onChange={(date, dateString) => {
                        const displayValue = date
                            ? date.format("MMM DD, YYYY")
                            : "";
                        setFilter(key, dateString || null, label, displayValue);
                    }}
                    placeholder={placeholder || `Select ${label.toLowerCase()}`}
                    style={{ width: "100%" }}
                    format="YYYY-MM-DD"
                />
            );
        }

        if (type === "daterange") {
            const startKey = `${key}_start` || "start_date";
            const endKey = `${key}_end` || "end_date";
            const startValue = filters[startKey];
            const endValue = filters[endKey];

            return (
                <RangePicker
                    value={[
                        startValue ? dayjs(startValue) : null,
                        endValue ? dayjs(endValue) : null,
                    ]}
                    onChange={(dates, dateStrings) => {
                        const displayValue =
                            dates && dates[0] && dates[1]
                                ? `${dates[0].format(
                                      "MMM DD, YYYY"
                                  )} to ${dates[1].format("MMM DD, YYYY")}`
                                : "";

                        setFilter(
                            startKey,
                            dateStrings[0] || null,
                            `${label} Start`,
                            dates?.[0] ? dates[0].format("MMM DD, YYYY") : ""
                        );
                        setFilter(
                            endKey,
                            dateStrings[1] || null,
                            `${label} End`,
                            dates?.[1] ? dates[1].format("MMM DD, YYYY") : ""
                        );
                    }}
                    style={{ width: "100%" }}
                    format="YYYY-MM-DD"
                />
            );
        }

        if (type === "number") {
            return (
                <InputNumber
                    value={value}
                    onChange={(val) => setFilter(key, val)}
                    placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                    style={{ width: "100%" }}
                />
            );
        }

        if (type === "numberrange") {
            const minKey = `min_${key}`;
            const maxKey = `max_${key}`;
            const minValue = filters[minKey];
            const maxValue = filters[maxKey];

            return (
                <Row gutter={8}>
                    <Col span={12}>
                        <InputNumber
                            value={minValue}
                            onChange={(val) => {
                                const displayValue = val
                                    ? `Min: ${val.toLocaleString()}`
                                    : "";
                                setFilter(
                                    minKey,
                                    val,
                                    `Min ${label}`,
                                    displayValue
                                );
                            }}
                            placeholder="Min"
                            style={{ width: "100%" }}
                        />
                    </Col>
                    <Col span={12}>
                        <InputNumber
                            value={maxValue}
                            onChange={(val) => {
                                const displayValue = val
                                    ? `Max: ${val.toLocaleString()}`
                                    : "";
                                setFilter(
                                    maxKey,
                                    val,
                                    `Max ${label}`,
                                    displayValue
                                );
                            }}
                            placeholder="Max"
                            style={{ width: "100%" }}
                        />
                    </Col>
                </Row>
            );
        }

        return null;
    };

    // Group fields by sections for better organization
    const groupedFields = config.fields.reduce((acc, field) => {
        const section = field.section || "General";
        if (!acc[section]) {
            acc[section] = [];
        }
        acc[section].push(field);
        return acc;
    }, {} as Record<string, any[]>);

    return (
        <div className="space-y-6">
            {Object.entries(groupedFields).map(
                ([sectionName, sectionFields], index) => (
                    <div key={sectionName}>
                        {index > 0 && <Divider />}
                        <div>
                            <Title level={5} className="!mb-3">
                                {sectionName}
                            </Title>
                            <Row gutter={[16, 16]}>
                                {sectionFields.map((field, fieldIndex) => (
                                    <Col
                                        key={field.key}
                                        span={
                                            field.span ||
                                            (sectionFields.length === 1
                                                ? 24
                                                : 12)
                                        }
                                    >
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {field.label}
                                        </label>
                                        {renderField(field)}
                                    </Col>
                                ))}
                            </Row>
                        </div>
                    </div>
                )
            )}
        </div>
    );
};

export default UniversalFilterForm;
