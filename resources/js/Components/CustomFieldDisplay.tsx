import { Descriptions, Tag } from "antd";
import dayjs from "dayjs";

interface Field {
    id: string | number;
    label: string;
    type: string;
    values?: Record<string, string>;
    custom_field_category_id?: string | number;
}

interface Props {
    fields: Field[];
    customFieldsData?: Record<string, any>;
    categoryId?: string | number;
    column?: number;
}

export default function CustomFieldDisplay({
    fields,
    customFieldsData,
    categoryId,
    column = 2,
}: Props) {
    // Filter fields by category if categoryId is provided
    const filteredFields = categoryId
        ? fields.filter(
              (field) => field.custom_field_category_id === categoryId
          )
        : fields;

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
            return <span className="text-gray-500">--</span>;
        }

        switch (field.type) {
            case "date":
                return dayjs(value).format("MMM DD, YYYY");

            case "datetime":
                return dayjs(value).format("MMM DD, YYYY HH:mm");

            case "select":
                if (field.values && field.values[value]) {
                    return (
                        <Tag color="blue" className="font-medium">
                            {field.values[value]}
                        </Tag>
                    );
                }
                return value;

            case "multiselect":
                if (Array.isArray(value)) {
                    return (
                        <div className="flex flex-wrap gap-1">
                            {value.map((item, index) => (
                                <Tag key={index} color="blue">
                                    {field.values?.[item] || item}
                                </Tag>
                            ))}
                        </div>
                    );
                }
                return value;

            case "file":
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
                const formattedValue = formatFieldValue(field, value);

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
                        {formattedValue}
                    </Descriptions.Item>
                );
            })}
        </Descriptions>
    );
}
