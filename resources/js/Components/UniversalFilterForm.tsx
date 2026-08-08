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
import {
    companyDateDayjsFormat,
    formatCompanyDate,
} from "@/lib/companyDateTime";

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface UniversalFilterFormProps {
    config: FilterConfig;
    /** Remote option data is still in flight — only the selects that need it show a spinner. */
    optionsLoading?: boolean;
}

const UniversalFilterForm: React.FC<UniversalFilterFormProps> = ({
    config,
    optionsLoading = false,
}) => {
    // Use draftFilters for form display (pending changes before Apply)
    const { draftFilters: filters, setFilter, setConfig } = useFilter();
    const { props } = usePage<any>();

    // Initialize config when component mounts
    // useEffect(() => {
    //     setConfig(config);
    // }, [config]);

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
            // Fields with hardcoded options (Yes/No, lead type) are never empty,
            // so they never show a spinner.
            const awaitingOptions =
                optionsLoading && selectOptions.length === 0;

            return (
                <Select
                    loading={awaitingOptions}
                    disabled={awaitingOptions}
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

                        // Check for dependent fields and clear them
                        config.fields.forEach((field) => {
                            if (field.dependsOn === key) {
                                setFilter(field.key, null);
                            }
                        });
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
            const awaitingOptions =
                optionsLoading && selectOptions.length === 0;

            return (
                <Select
                    mode="multiple"
                    loading={awaitingOptions}
                    disabled={awaitingOptions}
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
                    onChange={(date) => {
                        const displayValue = date
                            ? formatCompanyDate(date)
                            : "";
                        setFilter(
                            key,
                            date ? date.format("YYYY-MM-DD") : null,
                            label,
                            displayValue,
                        );
                    }}
                    placeholder={placeholder || `Select ${label.toLowerCase()}`}
                    style={{ width: "100%" }}
                    format={companyDateDayjsFormat()}
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
                    onChange={(dates) => {
                        setFilter(
                            startKey,
                            dates?.[0] ? dates[0].format("YYYY-MM-DD") : null,
                            `${label} Start`,
                            dates?.[0] ? formatCompanyDate(dates[0]) : "",
                        );
                        setFilter(
                            endKey,
                            dates?.[1] ? dates[1].format("YYYY-MM-DD") : null,
                            `${label} End`,
                            dates?.[1] ? formatCompanyDate(dates[1]) : "",
                        );
                    }}
                    style={{ width: "100%" }}
                    format={companyDateDayjsFormat()}
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

    const visibleFields = config.fields.filter((field) => {
        // If excludeFields is defined in config, filter them out
        if (config.excludeFields && config.excludeFields.includes(field.key)) {
            return false;
        }
        if (field.hidden) {
            return false;
        }
        return true;
    });

    // Group fields by sections for better organization
    const groupedFields = visibleFields.reduce((acc, field) => {
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
