import { Descriptions, Tag } from "antd";
import dayjs from "dayjs";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { CustomField } from "@/Types";
import EditableField from "@/Components/EditableField";

interface Field {
    id: string | number;
    label: string;
    type: string;
    values?: Record<string, string> | string; // Updated to handle string (JSON) or object
    custom_field_category_id?: string | number;
    show_rule_set?: any; // Visibility rules
}

interface Props {
    fields: Field[];
    customFieldsData?: Record<string, any>;
    categoryId?: string | number;
    column?: number;
    onUpdate?: (field: string, value: any) => Promise<void>;
    editable?: boolean;
    loading?: boolean;
}

export default function CustomFieldDisplay({
    fields,
    customFieldsData,
    categoryId,
    column = 2,
    onUpdate,
    editable = false,
    loading = false,
}: Props) {
    // Filter fields by category if categoryId is provided
    let filteredFields = categoryId
        ? fields.filter(
              (field) => field.custom_field_category_id === categoryId
          )
        : fields;

    // Apply visibility rules if customFieldsData is provided
    // Convert customFieldsData to the format expected by visibility evaluator
    const fieldValuesForVisibility: Record<string, any> = {};
    if (customFieldsData) {
        Object.keys(customFieldsData).forEach((key) => {
            // Ensure keys are in format "field_47"
            if (key.startsWith("field_")) {
                fieldValuesForVisibility[key] = customFieldsData[key];
            } else {
                fieldValuesForVisibility[`field_${key}`] =
                    customFieldsData[key];
            }
        });
    }

    // Evaluate visibility for all fields
    // Convert Field[] to CustomField[] format for evaluation
    const customFieldsForEvaluation: CustomField[] = filteredFields.map(
        (field) => {
            // Handle values: may already be a JSON string from backend, or an object
            let valuesString: string | null = null;
            if (field.values) {
                if (typeof field.values === "string") {
                    // Already a string, use as-is (may be JSON string or plain string)
                    valuesString = field.values;
                } else {
                    // Object/array, stringify it
                    valuesString = JSON.stringify(field.values);
                }
            }

            return {
                id:
                    typeof field.id === "string"
                        ? parseInt(field.id)
                        : field.id,
                label: field.label,
                name: `field_${field.id}`,
                type: field.type,
                required: "no",
                values: valuesString,
                custom_field_group_id: 0,
                show_table: "no",
                field_display_name: field.label,
                field_order: 0,
                display_order: 0,
                show_rule_set: field.show_rule_set,
            };
        }
    );

    const visibilityMap = evaluateAllFieldsVisibility(
        customFieldsForEvaluation,
        fieldValuesForVisibility
    );

    // Filter out fields that are not visible
    filteredFields = filteredFields.filter((field) => {
        const fieldId =
            typeof field.id === "string" ? parseInt(field.id) : field.id;
        return visibilityMap[fieldId] !== false;
    });

    // Calculate optimal span based on content length and field type
    const calculateSpan = (field: Field, value: any): number => {
        const labelLength = field.label?.length || 0;

        // Get string representation of value for length calculation
        let valueString = "";
        if (field.type === "file") {
            valueString = "Download File"; // Length of the link text
        } else if (field.type === "url" || field.type === "email") {
            valueString = String(value || "");
        } else if (field.type === "multiselect" && Array.isArray(value)) {
            valueString = value.join(", ");
        } else {
            valueString = String(value || "");
        }

        const valueLength = valueString.length;
        const totalContentLength = labelLength + valueLength;

        // Field types that typically need more space
        const wideFieldTypes = [
            "textarea",
            "file",
            "text",
            "url",
            "multiselect",
        ];

        // Content length thresholds (adjusted for better UX)
        const shortContent = 25; // Very short content
        const mediumContent = 50; // Medium length content
        const longContent = 80; // Long content needs full width

        // Start with base span based on field type
        let baseSpan = wideFieldTypes.includes(field.type) ? 2 : 1;

        // Adjust span based on content length
        if (totalContentLength > longContent) {
            baseSpan = column; // Full width for very long content
        } else if (totalContentLength > mediumContent) {
            baseSpan = Math.min(column, 2); // At least 2 columns for medium content
        } else if (totalContentLength > shortContent && baseSpan === 1) {
            baseSpan = Math.min(column, 2); // Expand short content if there's room
        }

        // Special cases for specific field types
        if (field.type === "textarea" && valueLength > 100) {
            baseSpan = column; // Always full width for long text areas
        }

        if (
            field.type === "multiselect" &&
            Array.isArray(value) &&
            value.length > 3
        ) {
            baseSpan = column; // Full width for multiple selections
        }

        // Ensure span doesn't exceed column count and is at least 1
        return Math.max(1, Math.min(baseSpan, column));
    };

    // Format field value based on type
    const formatFieldValue = (field: Field, value: any) => {
        if (!value && value !== 0) {
            if (!editable) return <span className="text-gray-500">--</span>;
            // If editable, proceed to render component or empty string wrapper
        }

        switch (field.type) {
            case "date":
                return dayjs(value).format("MMM DD, YYYY");

            case "datetime":
                return dayjs(value).format("MMM DD, YYYY HH:mm");

            case "select":
                let label = value;
                // Parse values if string
                let valuesObj = field.values;
                if (typeof valuesObj === "string") {
                    try {
                        valuesObj = JSON.parse(valuesObj);
                    } catch (e) {}
                }

                if (valuesObj && (valuesObj as any)[value]) {
                    label = (valuesObj as any)[value];
                    return (
                        <Tag color="blue" className="font-medium">
                            {label}
                        </Tag>
                    );
                }
                return value;

            case "multiselect":
                if (Array.isArray(value)) {
                    // Parse values map if needed
                    let valuesMap = field.values;
                    if (typeof valuesMap === "string") {
                        try {
                            valuesMap = JSON.parse(valuesMap);
                        } catch (e) {}
                    }

                    return (
                        <div className="flex flex-wrap gap-1">
                            {value.map((item, index) => (
                                <Tag key={index} color="blue">
                                    {(valuesMap as any)?.[item] || item}
                                </Tag>
                            ))}
                        </div>
                    );
                }
                return value;

            case "file":
                if (!value) return null;
                return (
                    <a
                        href={`/storage/custom_fields/${value}`}
                        className="text-blue-600 hover:text-blue-800"
                        download
                    >
                        Download File
                    </a>
                );

            case "url":
                return (
                    <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                    >
                        {value}
                    </a>
                );

            case "email":
                return (
                    <a
                        href={`mailto:${value}`}
                        className="text-blue-600 hover:text-blue-800"
                    >
                        {value}
                    </a>
                );

            case "phone":
                return (
                    <a
                        href={`tel:${value}`}
                        className="text-blue-600 hover:text-blue-800"
                    >
                        {value}
                    </a>
                );

            case "number":
                return typeof value === "number"
                    ? value.toLocaleString()
                    : value;

            case "currency":
                return typeof value === "number"
                    ? `$${value.toLocaleString()}`
                    : value;

            case "textarea":
                // Preserve line breaks for textarea content
                return (
                    <div className="whitespace-pre-wrap break-words">
                        {value}
                    </div>
                );

            case "checkbox":
            case "boolean":
                return (
                    <Tag color={value ? "green" : "red"}>
                        {value ? "Yes" : "No"}
                    </Tag>
                );

            case "radio":
                return (
                    <Tag color="blue" className="font-medium">
                        {value}
                    </Tag>
                );

            case "time":
                return dayjs(value, "HH:mm:ss").format("hh:mm A");

            case "password":
                return <span className="text-gray-500">••••••••</span>;

            default:
                // Handle long text content with word breaking
                if (typeof value === "string" && value.length > 50) {
                    return <div className="break-words">{value}</div>;
                }
                return value;
        }
    };

    const renderEditable = (field: Field, value: any) => {
        if (!editable || !onUpdate) {
            return formatFieldValue(field, value);
        }

        // Logic to select input type based on field type
        let type:
            | "text"
            | "number"
            | "date"
            | "select"
            | "boolean"
            | "textarea"
            | "email" = "text";
        let options: { label: string; value: string | number }[] = [];

        switch (field.type) {
            case "number":
            case "currency":
                type = "number";
                break;
            case "date":
                type = "date";
                break;
            case "textarea":
                type = "textarea";
                break;
            case "email":
                type = "email";
                break;
            case "select":
            case "radio":
                type = "select";
                let valuesObj = field.values;
                if (typeof valuesObj === "string") {
                    try {
                        valuesObj = JSON.parse(valuesObj);
                    } catch (e) {}
                }
                if (valuesObj) {
                    options = Object.entries(valuesObj).map(([k, v]) => ({
                        label: v as string,
                        value: k,
                    }));
                }
                break;
            case "checkbox":
            case "boolean":
                type = "boolean";
                break;
            default:
                type = "text";
        }

        if (["file", "multiselect", "time"].includes(field.type)) {
            return formatFieldValue(field, value);
        }

        return (
            <EditableField
                value={value}
                fieldName={`field_${field.id}`}
                fieldType={type}
                onSave={(val) => onUpdate!(`field_${field.id}`, val)}
                options={options}
                displayValue={formatFieldValue(field, value)}
                loading={loading}
            />
        );
    };

    if (filteredFields.length === 0) {
        return (
            <div className="text-center py-8">
                <span className="text-gray-500">
                    No custom fields available
                </span>
            </div>
        );
    }

    return (
        <Descriptions column={column} bordered size="middle">
            {filteredFields.map((field) => {
                const value = customFieldsData?.[`field_${field.id}`];
                const span = calculateSpan(field, value);

                return (
                    <Descriptions.Item
                        key={field.id}
                        label={
                            <div className="max-w-[120px] sm:max-w-[150px] whitespace-normal break-words leading-tight">
                                {field.label}
                            </div>
                        }
                        span={span}
                    >
                        {renderEditable(field, value)}
                    </Descriptions.Item>
                );
            })}
        </Descriptions>
    );
}
