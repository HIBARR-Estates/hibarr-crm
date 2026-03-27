import {
    Tag,
    Upload,
    Button,
    message,
    Spin,
    Tooltip,
    Progress,
} from "antd";
import { DetailSection, DetailField } from "@/Components/DetailSection";
import {
    UploadOutlined,
    DeleteOutlined,
    DownloadOutlined,
    FileOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { formatCountryForDisplay, formatMobileForDisplay } from "@/lib/utils";
import { type CustomField, type RepeatableItemSchema } from "@/Types";
import EditableField from "@/Components/EditableField";
import EditableRepeatableField from "@/Components/EditableRepeatableField";
import React, { useState } from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import { getFileUploadService } from "@/Services/FileUploadService";

const DEFAULT_CURRENCY_CODE = "USD";

interface ParsedCurrency {
    amount: number;
    currency: string;
}

/**
 * Parses a stored currency value into { amount, currency }.
 * Supports: number, "CODE|amount" (e.g. USD|1200), JSON string, object with amount/currency.
 */
function parseCurrencyValue(value: unknown): ParsedCurrency | null {
    if (value == null || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) {
        return { amount: value, currency: DEFAULT_CURRENCY_CODE };
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "") return null;
        const pipeMatch = /^([A-Z]{2,3})\|(.+)$/.exec(trimmed);
        if (pipeMatch) {
            const amount = parseFloat(pipeMatch[2].replace(/,/g, ""));
            return Number.isFinite(amount)
                ? { amount, currency: pipeMatch[1] }
                : null;
        }
        const num = parseFloat(trimmed.replace(/,/g, ""));
        if (Number.isFinite(num))
            return { amount: num, currency: DEFAULT_CURRENCY_CODE };
        try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (typeof parsed === "number")
                return { amount: parsed, currency: DEFAULT_CURRENCY_CODE };
            if (parsed && typeof parsed === "object" && "amount" in parsed) {
                const amount =
                    typeof (parsed as { amount: unknown }).amount === "number"
                        ? (parsed as { amount: number }).amount
                        : parseFloat(
                              String(
                                  (parsed as { amount: unknown }).amount ?? 0,
                              ).replace(/,/g, ""),
                          );
                const currency = String(
                    (parsed as { currency?: string }).currency ||
                        DEFAULT_CURRENCY_CODE,
                );
                return Number.isFinite(amount) ? { amount, currency } : null;
            }
        } catch {
            // not JSON
        }
    }
    if (value && typeof value === "object" && "amount" in value) {
        const obj = value as { amount?: unknown; currency?: string };
        const amount =
            typeof obj.amount === "number"
                ? obj.amount
                : parseFloat(String(obj.amount ?? 0).replace(/,/g, ""));
        const currency = obj.currency || DEFAULT_CURRENCY_CODE;
        return Number.isFinite(amount) ? { amount, currency } : null;
    }
    return null;
}

/** Normalize repeatable field value to an array of item objects. */
function parseRepeatableItems(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value))
        return value.filter((o) => o && typeof o === "object") as Record<
            string,
            unknown
        >[];
    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value) as unknown;
            if (Array.isArray(parsed))
                return parsed.filter(
                    (o) => o && typeof o === "object",
                ) as Record<string, unknown>[];
            if (parsed && typeof parsed === "object")
                return [parsed as Record<string, unknown>];
        } catch {
            // ignore
        }
    }
    if (value && typeof value === "object" && !Array.isArray(value))
        return [value as Record<string, unknown>];
    return [];
}

/** Build key -> type map from repeatable schema (field.values). */
function getRepeatableSchemaMap(
    values:
        | string
        | Array<{ key: string; type: string; label: string }>
        | Record<string, string>
        | undefined,
): Record<string, string> {
    const schemaArr: Array<{ key: string; type: string; label: string }> =
        Array.isArray(values)
            ? values
            : typeof values === "string" && values.trim()
              ? (() => {
                    try {
                        const p = JSON.parse(values) as Array<{
                            key: string;
                            type: string;
                            label: string;
                        }>;
                        return Array.isArray(p) ? p : [];
                    } catch {
                        return [];
                    }
                })()
              : [];
    const map: Record<string, string> = {};
    schemaArr.forEach((s) => {
        if (s?.key) map[s.key] = s.type || "text";
    });
    return map;
}

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

// Get display name from filename or URL
const getDisplayName = (fileValue: string): string => {
    // If it's an external URL, extract the filename from the URL path
    if (fileValue.startsWith("http")) {
        try {
            const url = new URL(fileValue);
            const pathParts = url.pathname.split("/").filter(Boolean);
            const lastPart = pathParts[pathParts.length - 1] || "File";
            // Decode URL-encoded filename
            return decodeURIComponent(lastPart);
        } catch {
            return "File";
        }
    }
    // If filename is a hash with extension (like abc123def.pdf), just show truncated
    if (/^[a-f0-9]{20,}\.[a-z0-9]+$/i.test(fileValue)) {
        const ext = fileValue.split(".").pop();
        return `File.${ext}`;
    }
    return fileValue;
};

// Check if a file value is an external URL
const isExternalUrl = (value: string): boolean =>
    value.startsWith("http://") || value.startsWith("https://");

// Extract objectPath from an external URL for deletion
// e.g. https://minio.hibarr.org/backend-uploads/custom_fields/abc.pdf → custom_fields/abc.pdf
const extractObjectPath = (url: string): string | null => {
    try {
        const parsed = new URL(url);
        // Remove leading slash and first path segment (bucket name)
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
            return parts.slice(1).join("/");
        }
        return parts.join("/") || null;
    } catch {
        return null;
    }
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
    const [uploadProgress, setUploadProgress] = useState(0);

    // Parse existing files
    const existingFiles = parseFileValue(value);

    // Handle file upload via external FileUploadService
    const handleBeforeUpload = async (file: File, fileList: File[]) => {
        // Only process when we receive the last file in the batch
        const isLastFile = file === fileList[fileList.length - 1];
        if (!isLastFile) {
            return false;
        }

        setUploading(true);
        setUploadProgress(0);
        try {
            const service = getFileUploadService();
            let uploadedUrls: string[] = [];

            if (fileList.length === 1) {
                const result = await service.uploadSingle(
                    fileList[0],
                    "custom_fields",
                    (_fileId, progress) => setUploadProgress(progress),
                );
                uploadedUrls = [result.downloadUrl];
            } else {
                const results = await service.uploadMultiple(
                    fileList,
                    "custom_fields",
                    (_fileId, progress) => setUploadProgress(progress),
                );
                uploadedUrls = results.map((r) => r.downloadUrl);
            }

            // Combine with existing files if adding to existing list
            const allFiles = [...existingFiles, ...uploadedUrls];
            const saveValue =
                allFiles.length === 1 ? allFiles[0] : JSON.stringify(allFiles);

            await onSave(fieldKey, saveValue);
            message.success(
                fileList.length > 1
                    ? `${fileList.length} files uploaded successfully`
                    : "File uploaded successfully",
            );
        } catch (error) {
            console.error("File upload failed:", error);
            message.error("Failed to upload file(s)");
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }

        return false; // Prevent default upload behavior
    };

    const handleRemove = async (fileToRemove?: string) => {
        setUploading(true);
        try {
            // Try to delete from external storage if it's an external URL
            if (fileToRemove && isExternalUrl(fileToRemove)) {
                const objectPath = extractObjectPath(fileToRemove);
                if (objectPath) {
                    try {
                        const service = getFileUploadService();
                        await service.deleteSingle(objectPath);
                    } catch (deleteErr) {
                        console.warn(
                            "Failed to delete from external storage, continuing with removal:",
                            deleteErr,
                        );
                    }
                }
            }

            if (multiple && fileToRemove && existingFiles.length > 1) {
                // Remove specific file from the list
                const remainingFiles = existingFiles.filter(
                    (f) => f !== fileToRemove,
                );
                await onSave(
                    fieldKey,
                    remainingFiles.length > 0
                        ? remainingFiles.length === 1
                            ? remainingFiles[0]
                            : JSON.stringify(remainingFiles)
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

    if (uploading && uploadProgress > 0) {
        return (
            <div className="w-full">
                <Progress
                    percent={uploadProgress}
                    size="small"
                    status="active"
                />
            </div>
        );
    }

    if (isLoading) {
        return <Spin size="small" />;
    }

    // Render file list
    if (existingFiles.length > 0) {
        return (
            <div className="space-y-1">
                {existingFiles.map((fileValue, index) => {
                    const fileUrl = isExternalUrl(fileValue)
                        ? fileValue
                        : `/user-uploads/custom_fields/${fileValue}`;
                    const displayName = getDisplayName(fileValue);

                    return (
                        <div
                            key={`${fileValue}-${index}`}
                            className="flex items-center gap-2 py-1"
                        >
                            <Tooltip title={displayName}>
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
                                    onClick={() => handleRemove(fileValue)}
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
    values?:
        | Record<string, string>
        | string
        | Array<{ key: string; type: string; label: string }>; // options or repeatable schema
    custom_field_category_id?: string | number;
    show_rule_set?: any; // Visibility rules
    /** For type=repeatable: the field whose value (N) dictates how many blocks to render */
    linked_field_id?: number | null;
    /** Config for default/aggregate display: what is shown and how (e.g. which field is aggregated) */
    display_config?: {
        useDefaultDisplay?: boolean;
        fieldKey?: string;
        aggregateBy?:
            | "first"
            | "last"
            | "concat"
            | "sum"
            | "sum_currency"
            | "count"
            | "list";
        separator?: string;
        format?: string;
    } | null;
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

    const defaultSymbols: Record<string, string> = {
        USD: "$",
        EUR: "€",
        GBP: "£",
    };
    const formatCurrencyAsNode = (
        amount: number,
        currencyCode: string,
    ): React.ReactNode => {
        const code = currencyCode || appDefaultCurrency;
        let symbol = defaultSymbols[code] ?? "";
        if (currencies.length > 0 && code) {
            const c = currencies.find(
                (x: any) =>
                    x.currency_code === code ||
                    (x.currency_name &&
                        String(x.currency_name).toUpperCase() ===
                            code.toUpperCase()),
            );
            symbol = c?.currency_symbol ?? symbol;
        }
        const formatted = Number.isFinite(amount)
            ? amount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
              })
            : "0.00";
        return (
            <span className="font-medium">
                {symbol}
                {formatted}
            </span>
        );
    };

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
                linked_field_id: field.linked_field_id ?? undefined,
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
        } else if (field.type === "repeatable" && Array.isArray(value)) {
            valueString = value
                .map((obj: Record<string, any>) =>
                    obj && typeof obj === "object"
                        ? Object.values(obj).filter(Boolean).join(", ")
                        : "",
                )
                .filter(Boolean)
                .join("; ");
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
            "repeatable",
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

        if (
            field.type === "repeatable" &&
            Array.isArray(value) &&
            value.length > 1
        ) {
            baseSpan = column; // Full width for multiple repeatable items
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

            case "repeatable": {
                const items = parseRepeatableItems(value);
                if (items.length === 0) {
                    return <span className="text-gray-500">--</span>;
                }
                const schemaMap = getRepeatableSchemaMap(field.values);
                const formatPart = (v: unknown): string => {
                    if (v == null || v === "") return "";
                    if (typeof v === "boolean") return v ? "Yes" : "No";
                    if (Array.isArray(v)) {
                        const files = (v as { name?: string }[]).filter(
                            (x) => x?.name,
                        );
                        return files.length
                            ? files.map((f) => f.name).join(", ")
                            : "";
                    }
                    return String(v);
                };
                const formatPartWithSchema = (
                    k: string,
                    v: unknown,
                ): React.ReactNode => {
                    if (v == null || v === "") return null;
                    if (schemaMap[k] === "currency") {
                        const parsed = parseCurrencyValue(v);
                        if (parsed)
                            return formatCurrencyAsNode(
                                parsed.amount,
                                parsed.currency,
                            );
                    }
                    return formatPart(v);
                };
                const dc = field.display_config;
                if (dc?.useDefaultDisplay && dc?.fieldKey) {
                    const key = dc.fieldKey;
                    const sep = dc.separator ?? ", ";
                    const rawValues = items
                        .map((obj) => obj[key])
                        .filter((v) => v != null && v !== "");
                    if (rawValues.length === 0) {
                        return <span className="text-gray-500">--</span>;
                    }
                    let displayValue: string | number | React.ReactNode;
                    switch (dc.aggregateBy) {
                        case "first":
                            displayValue =
                                schemaMap[key] === "currency"
                                    ? formatPartWithSchema(key, rawValues[0])
                                    : formatPart(rawValues[0]);
                            break;
                        case "last":
                            displayValue =
                                schemaMap[key] === "currency"
                                    ? formatPartWithSchema(
                                          key,
                                          rawValues[rawValues.length - 1],
                                      )
                                    : formatPart(
                                          rawValues[rawValues.length - 1],
                                      );
                            break;
                        case "concat":
                        case "list":
                            displayValue = rawValues
                                .map((v) => formatPart(v))
                                .join(sep);
                            break;
                        case "sum": {
                            const nums = rawValues.map((v) => {
                                const n =
                                    typeof v === "number"
                                        ? v
                                        : Number(
                                              String(v).replace(
                                                  /[^0-9.-]/g,
                                                  "",
                                              ),
                                          );
                                return Number.isFinite(n) ? n : 0;
                            });
                            displayValue = nums.reduce((a, b) => a + b, 0);
                            break;
                        }
                        case "sum_currency": {
                            const parsed = rawValues
                                .map((v) => parseCurrencyValue(v))
                                .filter((p): p is ParsedCurrency => p != null);
                            if (parsed.length === 0) {
                                displayValue = formatCurrencyAsNode(
                                    0,
                                    appDefaultCurrency,
                                );
                            } else {
                                const total = parsed.reduce(
                                    (sum, p) => sum + p.amount,
                                    0,
                                );
                                const currency =
                                    parsed[0].currency || appDefaultCurrency;
                                displayValue = formatCurrencyAsNode(
                                    total,
                                    currency,
                                );
                            }
                            break;
                        }
                        case "count":
                            displayValue = rawValues.length;
                            break;
                        default:
                            displayValue = rawValues
                                .map((v) => formatPart(v))
                                .join(sep);
                    }
                    if (displayValue == null) {
                        return <span className="text-gray-500">--</span>;
                    }
                    if (React.isValidElement(displayValue)) {
                        if (!dc.format) return displayValue;
                        const parts = dc.format.split(/\{value\}/);
                        return (
                            <span>
                                {parts.map((text, i) => (
                                    <React.Fragment key={i}>
                                        {text}
                                        {i < parts.length - 1
                                            ? displayValue
                                            : null}
                                    </React.Fragment>
                                ))}
                            </span>
                        );
                    }
                    const text = dc.format
                        ? dc.format.replace(/\{value\}/g, String(displayValue))
                        : String(displayValue);
                    return <span>{text}</span>;
                }
                return (
                    <div className="space-y-2">
                        {items.map((obj, index) => {
                            const parts = Object.entries(obj)
                                .map(([k, v]) => ({
                                    k,
                                    node: formatPartWithSchema(k, v),
                                }))
                                .filter(
                                    ({ node }) => node != null && node !== "",
                                );
                            if (parts.length === 0) return null;
                            return (
                                <div key={index} className="text-sm">
                                    {field.label} {index + 1}:{" "}
                                    {parts.map(({ k, node }, i) => (
                                        <span key={k}>
                                            {i > 0 && ", "}
                                            <span className="text-gray-500 capitalize">
                                                {k}:
                                            </span>{" "}
                                            {node}
                                        </span>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                );
            }

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

            case "country": {
                const str = formatCountryForDisplay(value);
                return str ? (
                    <span>{str}</span>
                ) : (
                    <span className="text-gray-500">--</span>
                );
            }

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
            | "phone"
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
            case "phone":
                type = "phone";
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
                        options = valuesObj.map(
                            (
                                v:
                                    | string
                                    | {
                                          key: string;
                                          type: string;
                                          label: string;
                                      },
                            ) =>
                                typeof v === "string"
                                    ? { label: v, value: v }
                                    : { label: v.label, value: v.key },
                        );
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
                        const arr = multiCheckboxValues as (
                            | string
                            | { key: string; type: string; label: string }
                        )[];
                        options = arr.map((v) =>
                            typeof v === "string"
                                ? { label: v, value: v }
                                : { label: v.label, value: v.key },
                        );
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

        // Repeatable: editable via modal with RepeatableFieldRenderer
        if (field.type === "repeatable") {
            const repeatableValues:
                | string
                | RepeatableItemSchema[]
                | null
                | undefined =
                field.values === undefined || field.values === null
                    ? null
                    : Array.isArray(field.values) ||
                        typeof field.values === "string"
                      ? (field.values as string | RepeatableItemSchema[])
                      : null;
            return (
                <EditableRepeatableField
                    field={{
                        id:
                            typeof field.id === "string"
                                ? parseInt(field.id, 10)
                                : field.id,
                        label: field.label,
                        linked_field_id: field.linked_field_id ?? null,
                        values: repeatableValues,
                    }}
                    value={value}
                    fieldKey={fieldKey}
                    customFieldsData={customFieldsData ?? {}}
                    onSave={async (key, val) => {
                        await onUpdate!(key, val);
                    }}
                    loading={isFieldLoading}
                    editable={editable}
                    displayValue={formatFieldValue(field, value)}
                />
            );
        }

        // alwaysEditing should only be true when explicitly in bulk edit mode
        // When editable is false, we still render EditableField but in hover-to-edit mode
        const effectiveAlwaysEditing = alwaysEditing || editable;

        // Normalize value for editable components so country/phone never render as [object Object]
        let normalizedValue = value;
        if (field.type === "country" && value !== undefined && value !== null) {
            normalizedValue = formatCountryForDisplay(value);
        } else if (
            field.type === "phone" &&
            value !== undefined &&
            value !== null
        ) {
            normalizedValue = formatMobileForDisplay(value);
        }

        return (
            <EditableField
                value={normalizedValue}
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
        <DetailSection gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            {filteredFields.map((field) => {
                const fieldKey = `field_${field.id}`;
                const value =
                    customFieldsData?.[fieldKey] ??
                    customFieldsData?.[String(field.id)];
                const span = calculateSpan(field, value);

                return (
                    <DetailField
                        key={field.id}
                        label={field.label}
                        span={span === column ? 2 : 1}
                    >
                        {renderEditable(field, value)}
                    </DetailField>
                );
            })}
        </DetailSection>
    );
}
