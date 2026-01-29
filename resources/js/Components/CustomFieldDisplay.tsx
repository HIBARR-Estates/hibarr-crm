import {
    Descriptions,
    Tag,
    Upload,
    Button,
    message,
    Spin,
    Space,
    List,
    Tooltip,
} from "antd";
import {
    UploadOutlined,
    DeleteOutlined,
    DownloadOutlined,
    FileOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { CustomField } from "@/Types";
import EditableField from "@/Components/EditableField";
import React, { useState } from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";

// Helper to parse file value - can be single file string, comma-separated, or JSON array
const parseFileValue = (value: string | null): string[] => {
    if (!value) return [];

    // Try to parse as JSON array first
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.filter((f) => f && typeof f === "string");
        }
    } catch {
        // Not JSON, continue
    }

    // Check if it's comma-separated (but not a single filename with comma)
    // A filename typically has an extension, so we check for that pattern
    if (value.includes(",")) {
        const parts = value
            .split(",")
            .map((f) => f.trim())
            .filter((f) => f);
        // If all parts look like filenames (have extensions), treat as multiple files
        if (parts.every((p) => p.includes("."))) {
            return parts;
        }
    }

    // Single file
    return [value];
};

// Get display name from filename (extract original name if possible, otherwise show truncated hash)
const getDisplayName = (filename: string): string => {
    // If filename is a hash with extension (like abc123def.pdf), just show truncated
    if (/^[a-f0-9]{20,}\.[a-z0-9]+$/i.test(filename)) {
        const ext = filename.split(".").pop();
        return `File.${ext}`;
    }
    return filename;
};

// Editable File Field Component - supports multiple files
interface EditableFileFieldProps {
    value: string | null;
    fieldKey: string;
    onSave: (
        fieldKey: string,
        value: File[] | File | string | null,
    ) => Promise<void>;
    loading?: boolean;
    editable?: boolean;
    multiple?: boolean;
}

const EditableFileField: React.FC<EditableFileFieldProps> = ({
    value,
    fieldKey,
    onSave,
    loading = false,
    editable = true,
    multiple = true, // Default to supporting multiple files
}) => {
    const [uploading, setUploading] = useState(false);

    // Parse existing files
    const existingFiles = parseFileValue(value);

    // Handle file upload - for multiple files, fileList contains all selected files
    const handleBeforeUpload = async (file: File, fileList: File[]) => {
        // Only process when we receive the last file in the batch
        // fileList contains all files, but beforeUpload is called per file
        const isLastFile = file === fileList[fileList.length - 1];

        if (!isLastFile) {
            return false; // Skip processing until the last file
        }

        setUploading(true);
        try {
            // Send all selected files
            await onSave(fieldKey, fileList);
            message.success(
                fileList.length > 1
                    ? `${fileList.length} files uploaded successfully`
                    : "File uploaded successfully",
            );
        } catch (error) {
            message.error("Failed to upload file(s)");
        } finally {
            setUploading(false);
        }

        return false; // Prevent default upload behavior
    };

    const handleRemove = async (fileToRemove?: string) => {
        setUploading(true);
        try {
            if (multiple && fileToRemove && existingFiles.length > 1) {
                // Remove specific file from the list
                const remainingFiles = existingFiles.filter(
                    (f) => f !== fileToRemove,
                );
                // Send the remaining files as JSON string to update
                await onSave(
                    fieldKey,
                    remainingFiles.length > 0
                        ? JSON.stringify(remainingFiles)
                        : "",
                );
            } else {
                // Clear all files
                await onSave(fieldKey, "");
            }
            message.success("File removed successfully");
        } catch (error) {
            message.error("Failed to remove file");
        } finally {
            setUploading(false);
        }
    };

    const isLoading = loading || uploading;

    if (isLoading) {
        return <Spin size="small" />;
    }

    // Render file list
    if (existingFiles.length > 0) {
        return (
            <div className="space-y-1">
                {existingFiles.map((filename, index) => {
                    const fileUrl = `/user-uploads/custom_fields/${filename}`;
                    const displayName = getDisplayName(filename);

                    return (
                        <div
                            key={filename}
                            className="flex items-center gap-2 py-1"
                        >
                            <Tooltip title={filename}>
                                <a
                                    href={fileUrl}
                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm truncate max-w-[150px]"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <FileOutlined className="flex-shrink-0" />
                                    <span className="truncate">
                                        {displayName}
                                    </span>
                                </a>
                            </Tooltip>
                            <a
                                href={fileUrl}
                                className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                                download
                                title="Download"
                            >
                                <DownloadOutlined />
                            </a>
                            {editable && (
                                <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => handleRemove(filename)}
                                    className="flex-shrink-0"
                                    title="Remove file"
                                />
                            )}
                        </div>
                    );
                })}

                {/* Add more files button */}
                {editable && multiple && (
                    <Upload
                        beforeUpload={handleBeforeUpload}
                        showUploadList={false}
                        accept="*/*"
                        multiple={true}
                    >
                        <Button
                            type="dashed"
                            size="small"
                            icon={<PlusOutlined />}
                            className="mt-1"
                            loading={uploading}
                        >
                            Add File(s)
                        </Button>
                    </Upload>
                )}
            </div>
        );
    }

    if (!editable) {
        return <span className="text-gray-500">--</span>;
    }

    return (
        <Upload
            beforeUpload={handleBeforeUpload}
            showUploadList={false}
            accept="*/*"
            multiple={multiple}
        >
            <Button size="small" icon={<UploadOutlined />} loading={uploading}>
                Upload File{multiple ? "(s)" : ""}
            </Button>
        </Upload>
    );
};

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
    alwaysEditing?: boolean; // When true, fields are always in edit mode (for bulk editing)
    loading?: boolean; // Deprecated: use loadingField instead
    loadingField?: string | null; // The specific field currently being updated
    onChange?: (fieldName: string, value: any) => void; // For tracking changes in edit mode
    globalLoading?: boolean; // When true, all fields are disabled (e.g., during save all)
    disabled?: boolean; // When true, fields cannot be edited (for permission control)
}

export default function CustomFieldDisplay({
    fields,
    customFieldsData,
    categoryId,
    column = 2,
    onUpdate,
    editable = false,
    alwaysEditing = false,
    loading = false,
    loadingField = null,
    onChange,
    globalLoading = false,
    disabled = false,
}: Props) {
    const { props } = usePage<any>();
    const { currencies = [], default_currency_code } = props;

    // Use the application's default currency (current company setting)
    const appDefaultCurrency: string =
        default_currency_code ??
        currencies?.[0]?.code ??
        currencies?.[0]?.currency_code ??
        "USD";
    // Filter fields by category if categoryId is provided
    let filteredFields = categoryId
        ? fields.filter(
              (field) => field.custom_field_category_id === categoryId,
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
        },
    );

    const visibilityMap = evaluateAllFieldsVisibility(
        customFieldsForEvaluation,
        fieldValuesForVisibility,
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
                // Parse values - can be JSON string array or object
                let selectValues = field.values;
                if (typeof selectValues === "string") {
                    try {
                        selectValues = JSON.parse(selectValues);
                    } catch (e) {}
                }

                // Handle both array format ["opt1", "opt2"] and object format {"key": "label"}
                if (Array.isArray(selectValues)) {
                    // Array format - value is the string itself
                    if (selectValues.includes(value)) {
                        return (
                            <Tag color="blue" className="font-medium">
                                {value}
                            </Tag>
                        );
                    }
                } else if (selectValues && typeof selectValues === "object") {
                    // Object format - lookup by key
                    if ((selectValues as any)[value]) {
                        return (
                            <Tag color="blue" className="font-medium">
                                {(selectValues as any)[value]}
                            </Tag>
                        );
                    }
                }
                return value ? (
                    <Tag color="blue" className="font-medium">
                        {value}
                    </Tag>
                ) : (
                    <span className="text-gray-500">--</span>
                );

            case "multiselect":
            case "checkbox":
                if (Array.isArray(value) && value.length > 0) {
                    // Parse values - can be JSON string array or object
                    let multiValues = field.values;
                    if (typeof multiValues === "string") {
                        try {
                            multiValues = JSON.parse(multiValues);
                        } catch (e) {}
                    }

                    return (
                        <div className="flex flex-wrap gap-1">
                            {value.map((item, index) => {
                                // For array format, item is the display value
                                // For object format, lookup label by key
                                let displayLabel = item;
                                if (
                                    multiValues &&
                                    !Array.isArray(multiValues) &&
                                    typeof multiValues === "object"
                                ) {
                                    displayLabel =
                                        (multiValues as any)[item] || item;
                                }
                                return (
                                    <Tag key={index} color="blue">
                                        {displayLabel}
                                    </Tag>
                                );
                            })}
                        </div>
                    );
                }
                // Empty array or no value
                if (Array.isArray(value) && value.length === 0) {
                    return <span className="text-gray-500">--</span>;
                }
                // Single checkbox value (boolean-like)
                if (
                    typeof value === "boolean" ||
                    value === "1" ||
                    value === "0" ||
                    value === 1 ||
                    value === 0
                ) {
                    const boolVal =
                        value === true || value === "1" || value === 1;
                    return (
                        <Tag color={boolVal ? "green" : "red"}>
                            {boolVal ? "Yes" : "No"}
                        </Tag>
                    );
                }
                // No value at all
                if (!value) {
                    return <span className="text-gray-500">--</span>;
                }
                return value;

            case "file":
                // Parse file value - can be single string, JSON array, or comma-separated
                const files = parseFileValue(value);
                if (files.length === 0) {
                    return <span className="text-gray-500">--</span>;
                }

                return (
                    <div className="space-y-1">
                        {files.map((filename, index) => {
                            const fileUrl = `/user-uploads/custom_fields/${filename}`;
                            const displayName = getDisplayName(filename);

                            return (
                                <div
                                    key={filename}
                                    className="flex items-center gap-2"
                                >
                                    <Tooltip title={filename}>
                                        <a
                                            href={fileUrl}
                                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm truncate max-w-[150px]"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <FileOutlined className="flex-shrink-0" />
                                            <span className="truncate">
                                                {displayName}
                                            </span>
                                        </a>
                                    </Tooltip>
                                    <a
                                        href={fileUrl}
                                        className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                                        download
                                        title="Download"
                                    >
                                        <DownloadOutlined />
                                    </a>
                                </div>
                            );
                        })}
                    </div>
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

            case "phone": {
                // Supports:
                // - plain string "+905338773001"
                // - JSON string / object from antd-phone-input:
                //   {"countryCode":"90","areaCode":"533","phoneNumber":"8773001","isoCode":"tr"}
                // - JSON string / object from our custom PhoneInput:
                //   {"phone":"+905338773001","country_code":"90","country_identifier":"Turkey"}
                const parsePhoneValue = (
                    raw: any,
                ): { display: string; tel: string } => {
                    const fallback = String(raw ?? "");

                    const toDigits = (v: any) =>
                        String(v ?? "").replace(/[^\d]/g, "");

                    const formatFromParts = (
                        country: any,
                        area: any,
                        num: any,
                    ) => {
                        const cc = toDigits(country);
                        const ac = toDigits(area);
                        const pn = toDigits(num);
                        const digits = [cc, ac, pn].filter(Boolean).join("");
                        if (!digits) return null;
                        return {
                            display: `+${digits}`,
                            tel: `+${digits}`,
                        };
                    };

                    const formatFromE164 = (phone: any) => {
                        const s = String(phone ?? "").trim();
                        if (!s) return null;
                        // keep leading + if provided; otherwise just digits
                        const tel = s.startsWith("+") ? s : toDigits(s);
                        const display = s.startsWith("+") ? s : tel;
                        return tel ? { display, tel } : null;
                    };

                    let obj: any = raw;
                    if (typeof raw === "string") {
                        const trimmed = raw.trim();
                        // if it's already a normal phone string, don't show JSON
                        if (
                            trimmed.startsWith("+") ||
                            /^\d[\d\s().-]*$/.test(trimmed)
                        ) {
                            return (
                                formatFromE164(trimmed) ?? {
                                    display: fallback,
                                    tel: fallback,
                                }
                            );
                        }
                        try {
                            obj = JSON.parse(trimmed);
                        } catch {
                            return { display: fallback, tel: fallback };
                        }
                    }

                    if (obj && typeof obj === "object") {
                        // antd-phone-input shape
                        const fromAntd = formatFromParts(
                            obj.countryCode,
                            obj.areaCode,
                            obj.phoneNumber,
                        );
                        if (fromAntd) return fromAntd;

                        // our custom PhoneInput shape
                        const fromCustom = formatFromE164(obj.phone);
                        if (fromCustom) return fromCustom;
                    }

                    return { display: fallback, tel: fallback };
                };

                const { display, tel } = parsePhoneValue(value);
                return (
                    <a
                        href={`tel:${tel}`}
                        className="text-blue-600 hover:text-blue-800"
                    >
                        {display}
                    </a>
                );
            }

            case "number":
                return typeof value === "number"
                    ? value.toLocaleString()
                    : value;

            case "textarea":
                // Preserve line breaks for textarea content
                return (
                    <div className="whitespace-pre-wrap break-words">
                        {value}
                    </div>
                );

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

            case "currency": {
                let currencyData: {
                    amount: string | number | null;
                    currency: string;
                } | null = null;

                // Handle plain numbers (most common case from DB)
                if (typeof value === "number") {
                    currencyData = {
                        amount: value,
                        currency: appDefaultCurrency,
                    };
                }
                // Handle string numbers (e.g., "3235242")
                else if (
                    typeof value === "string" &&
                    !isNaN(Number(value)) &&
                    value.trim() !== ""
                ) {
                    const numValue = Number(value);
                    if (!isNaN(numValue)) {
                        currencyData = {
                            amount: numValue,
                            currency: appDefaultCurrency,
                        };
                    }
                }
                // Handle objects with amount property
                else if (
                    value &&
                    typeof value === "object" &&
                    value.amount !== undefined
                ) {
                    currencyData = value;
                }
                // Handle JSON strings
                else if (value && typeof value === "string") {
                    try {
                        const parsed = JSON.parse(value);
                        // If JSON.parse returns a number, treat it as amount
                        if (typeof parsed === "number") {
                            currencyData = {
                                amount: parsed,
                                currency: appDefaultCurrency,
                            };
                        } else if (
                            typeof parsed === "object" &&
                            parsed !== null
                        ) {
                            currencyData = parsed;
                        }
                    } catch {
                        currencyData = {
                            amount: value,
                            currency: appDefaultCurrency,
                        };
                    }
                }

                // Ensure currencyData has a currency property with a default
                if (currencyData) {
                    currencyData.currency =
                        currencyData.currency || appDefaultCurrency;
                }

                if (
                    currencyData &&
                    currencyData.amount !== null &&
                    currencyData.amount !== ""
                ) {
                    const defaultSymbols: Record<string, string> = {
                        USD: "$",
                        EUR: "€",
                        GBP: "£",
                    };

                    const currencyCode =
                        currencyData.currency || appDefaultCurrency;
                    let symbol = defaultSymbols[currencyCode] || "";
                    if (currencies.length > 0 && currencyCode) {
                        const currency = currencies.find(
                            (c: any) =>
                                c.currency_code === currencyCode ||
                                (c.currency_name &&
                                    c.currency_name.toUpperCase() ===
                                        currencyCode.toUpperCase()),
                        );
                        symbol = currency?.currency_symbol || symbol;
                    }

                    // Format amount with commas
                    const amount =
                        typeof currencyData.amount === "number"
                            ? currencyData.amount
                            : parseFloat(
                                  String(currencyData.amount).replace(/,/g, ""),
                              );

                    if (!isNaN(amount)) {
                        const formatted = amount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        });
                        return (
                            <span className="font-medium">
                                {symbol}
                                {formatted}
                            </span>
                        );
                    }
                }
                return <span className="text-gray-500">--</span>;
            }

            default:
                // Handle long text content with word breaking
                if (typeof value === "string" && value.length > 50) {
                    return <div className="break-words">{value}</div>;
                }
                return value;
        }
    };

    const renderEditable = (field: Field, value: any) => {
        // If no onUpdate handler, just display the value (read-only mode)
        if (!onUpdate) {
            return formatFieldValue(field, value);
        }

        // Logic to select input type based on field type
        let type:
            | "text"
            | "number"
            | "date"
            | "select"
            | "multiselect"
            | "boolean"
            | "textarea"
            | "country"
            | "email"
            | "currency" = "text";
        let options: { label: string; value: string | number }[] = [];

        switch (field.type) {
            case "number":
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
            case "country":
                type = "country";
                break;
            case "currency":
                type = "currency";
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
                    // Handle both array format ["opt1", "opt2"] and object format {"key": "label"}
                    if (Array.isArray(valuesObj)) {
                        options = valuesObj.map((v: string) => ({
                            label: v,
                            value: v,
                        }));
                    } else {
                        options = Object.entries(valuesObj).map(([k, v]) => ({
                            label: v as string,
                            value: k,
                        }));
                    }
                }
                break;
            case "multiselect":
            case "checkbox":
                // Check if checkbox/multiselect has values (options)
                let multiCheckboxValues = field.values;
                if (typeof multiCheckboxValues === "string") {
                    try {
                        multiCheckboxValues = JSON.parse(multiCheckboxValues);
                    } catch (e) {}
                }
                // If it has values array/object, it's a multi-select
                if (
                    multiCheckboxValues &&
                    (Array.isArray(multiCheckboxValues)
                        ? multiCheckboxValues.length > 0
                        : Object.keys(multiCheckboxValues).length > 0)
                ) {
                    type = "multiselect";
                    if (Array.isArray(multiCheckboxValues)) {
                        options = multiCheckboxValues.map((v: string) => ({
                            label: v,
                            value: v,
                        }));
                    } else {
                        options = Object.entries(multiCheckboxValues).map(
                            ([k, v]) => ({
                                label: v as string,
                                value: k,
                            }),
                        );
                    }
                } else {
                    // No values means simple boolean checkbox
                    type = "boolean";
                }
                break;
            case "boolean":
                type = "boolean";
                break;
            default:
                type = "text";
        }

        const fieldKey = `field_${field.id}`;
        const isFieldLoading =
            globalLoading ||
            loadingField === fieldKey ||
            (loading && !loadingField);

        // Handle file type with EditableFileField
        if (field.type === "file") {
            return (
                <EditableFileField
                    value={value}
                    fieldKey={fieldKey}
                    onSave={onUpdate!}
                    loading={isFieldLoading}
                    editable={editable && !disabled}
                />
            );
        }

        // Skip time type for now - needs special handling
        if (field.type === "time") {
            return formatFieldValue(field, value);
        }

        // alwaysEditing should only be true when explicitly in bulk edit mode
        // When editable is false, we still render EditableField but in hover-to-edit mode
        const effectiveAlwaysEditing = alwaysEditing || editable;

        return (
            <EditableField
                value={value}
                fieldName={fieldKey}
                fieldType={type}
                onSave={(val) => onUpdate!(fieldKey, val)}
                options={options}
                displayValue={formatFieldValue(field, value)}
                loading={isFieldLoading}
                alwaysEditing={effectiveAlwaysEditing}
                onChange={onChange}
                disabled={disabled}
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
