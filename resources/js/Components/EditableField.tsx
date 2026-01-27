import { useState, useRef, useEffect } from "react";
import { Input, Typography, message, Select, Skeleton, Spin, Space, Button, Upload } from "antd";
import {
    CheckOutlined,
    CloseOutlined,
    EditOutlined,
    LoadingOutlined,
    FileOutlined,
    DownloadOutlined,
    DeleteOutlined,
    UploadOutlined,
} from "@ant-design/icons";
import PhoneInput, { PhoneNumber } from "antd-phone-input";
import FormDataSelector from "./FormDataSelector";
import { FormDataType } from "@/Hooks/useFormData";
import { usePage } from "@inertiajs/react";

const { Text } = Typography;

interface EditableFieldProps {
    value: string | number | null | undefined | any[]; // Updated to accept array
    fieldName: string;
    fieldType?:
        | "text"
        | "email"
        | "number"
        | "phone"
        | "date"
        | "select"
        | "multiselect"
        | "boolean"
        | "textarea"
        | "country"
        | "file";
    selectorType?: FormDataType;
    mode?: "multiple" | "tags";
    onSave: (value: any) => Promise<void>;
    displayValue?: React.ReactNode;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    formatValue?: (value: any) => string;
    options?: { label: string; value: string | number }[];
    loading?: boolean;
    /** When true, the field renders in edit/input mode permanently (for bulk edit mode) */
    alwaysEditing?: boolean;
    /** Called when value changes in alwaysEditing mode (for tracking pending changes) */
    onChange?: (fieldName: string, value: any) => void;
}

export default function EditableField({
    value,
    fieldName,
    fieldType = "text",
    selectorType,
    mode,
    onSave,
    displayValue,
    placeholder = "Click to edit",
    className = "",
    disabled = false,
    formatValue,
    options = [],
    loading = false,
    alwaysEditing = false,
    onChange,
}: EditableFieldProps) {
    const { props } = usePage<any>();
    const { countries = [] } = props;
    
    const maxFileSizeMB = props?.company?.allowed_file_size || 10;
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
    const [editing, setEditing] = useState(alwaysEditing);
    const [inputValue, setInputValue] = useState<any>(value);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const isClickingActionRef = useRef(false);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (alwaysEditing) {
            setEditing(true);
            if (fieldType === "date" && value) {
                try {
                    const date = new Date(value.toString());
                    if (!isNaN(date.getTime())) {
                        setInputValue(date.toISOString().split("T")[0]);
                    } else {
                        setInputValue("");
                    }
                } catch {
                    setInputValue("");
                }
            } else if (fieldType === "multiselect" || Array.isArray(value)) {
                setInputValue(
                    Array.isArray(value) ? value : value ? [value] : []
                );
            } else {
                setInputValue(value ?? "");
            }
        } else {
            setEditing(false);
            setInputValue(value);
        }
    }, [alwaysEditing]);

    const isLocked = loading || saving;

 
    const canStartEditing = !isLocked && !disabled && fieldType !== "file";

    const startEditing = () => {
        if (!canStartEditing) return;
        setEditing(true);
        // For date fields, convert to YYYY-MM-DD format if value exists
        if (fieldType === "date" && value) {
            try {
                const date = new Date(value.toString());
                if (!isNaN(date.getTime())) {
                    setInputValue(date.toISOString().split("T")[0]);
                } else {
                    setInputValue("");
                }
            } catch {
                setInputValue("");
            }
        } else if (fieldType === "multiselect" || Array.isArray(value)) {
            // Keep array values as arrays for multiselect
            setInputValue(Array.isArray(value) ? value : value ? [value] : []);
        } else if (fieldType === "phone") {
            // For phone, keep as string if it's a plain number, or pass object as-is
            setInputValue(value ?? "");
        } else {
            setInputValue(value ?? "");
        }
    };

    const handleSave = async () => {
        // Clear any pending blur timeout to prevent double save
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        // Compare values properly for arrays and files
        const isArrayValue = Array.isArray(value) || Array.isArray(inputValue);
        const isFileValue = inputValue instanceof File;
        const valuesEqual = isFileValue
            ? false 
            : isArrayValue
            ? JSON.stringify(inputValue) === JSON.stringify(value)
            : inputValue === value;

        if (valuesEqual) {
            // In always editing mode, don't exit edit mode even if values are same
            if (!alwaysEditing) {
                setEditing(false);
            }
            return;
        }

        setSaving(true);
        try {
            await onSave(inputValue);
            // In always editing mode, stay in edit mode after save
            if (!alwaysEditing) {
                setEditing(false);
            }
            message.success("Field updated successfully");
        } catch (error: any) {
            message.error(
                error?.message || "Failed to update field. Please try again."
            );
        } finally {
            setSaving(false);
        }
    };

    // Handle blur - only save if not clicking on action buttons
    // When alwaysEditing is true, don't auto-save on blur
    const handleBlur = () => {
        // In always editing mode, don't auto-save on blur
        if (alwaysEditing) {
            return;
        }

        // Clear any existing timeout first
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
        }

        // Use setTimeout to allow mousedown on action buttons to set the flag first
        blurTimeoutRef.current = setTimeout(() => {
            if (!isClickingActionRef.current) {
                handleSave();
            }
            // Reset the flag
            isClickingActionRef.current = false;
            blurTimeoutRef.current = null;
        }, 100);
    };

    const handleCancel = () => {
        // Clear any pending blur timeout to prevent save after cancel
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        isClickingActionRef.current = false;
        // In always editing mode, don't exit edit mode, just restore original value
        if (!alwaysEditing) {
            setEditing(false);
        }
        // Restore original value, keeping arrays as arrays
        if (fieldType === "multiselect" || Array.isArray(value)) {
            setInputValue(Array.isArray(value) ? value : value ? [value] : []);
        } else if (fieldType === "file") {
            setInputValue(value ?? "");
        } else {
            setInputValue(value ?? "");
        }
    };

    // Handle action button mousedown - set flag to prevent blur from saving
    const handleActionMouseDown = () => {
        isClickingActionRef.current = true;
    };

    // Handle input value change - update state and notify parent in alwaysEditing mode
    const handleValueChange = (newValue: any) => {
        setInputValue(newValue);
        if (alwaysEditing && onChange) {
            onChange(fieldName, newValue);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            handleCancel();
        }
    };

    const handleFileUpload = async (file: File) => {
        if (file.size > maxFileSizeBytes) {
            message.error(`File size exceeds the maximum allowed size of ${maxFileSizeMB}MB`);
            return false;
        }

        setUploading(true);
        try {
            await onSave(file);
            message.success("File uploaded successfully");
        } catch (error: any) {
            if (error?.response?.status === 413) {
                message.error(`File is too large. Maximum allowed size is ${maxFileSizeMB}MB. Please check your server's upload_max_filesize and post_max_size settings.`);
            } else {
                message.error("Failed to upload file");
            }
        } finally {
            setUploading(false);
        }
        return false; 
    };

    const handleFileRemove = async () => {
        setUploading(true);
        try {
            await onSave("");
            message.success("File removed successfully");
        } catch (error) {
            message.error("Failed to remove file");
        } finally {
            setUploading(false);
        }
    };

    // Check if file field is loading
    const isFileLoading = loading || uploading;

    const renderFileField = () => {
        if (isFileLoading) {
            return <Spin size="small" />;
        }

        if (value && typeof value === "string") {
            const fileUrl = `/user-uploads/hibarr_fields/${value}`;
            return (
                <Space size="small">
                    <a
                        href={fileUrl}
                        className="text-blue-600 hover:text-blue-800"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FileOutlined className="mr-1" />
                        View File
                    </a>
                    <a
                        href={fileUrl}
                        className="text-blue-600 hover:text-blue-800"
                        download
                    >
                        <DownloadOutlined />
                    </a>
                    {!disabled && (
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={handleFileRemove}
                        />
                    )}
                </Space>
            );
        }

        if (disabled) {
            return <span className="text-gray-500">--</span>;
        }

        return (
            <Upload
                beforeUpload={handleFileUpload}
                showUploadList={false}
                accept="*/*"
            >
                <Button size="small" icon={<UploadOutlined />}>
                    Upload File
                </Button>
            </Upload>
        );
    };

    // For file fields, always render the permanent UI (like CustomFieldDisplay)
    // File fields don't have an "editing" mode - they're always available for upload/delete
    if (fieldType === "file") {
        return renderFileField();
    }

    const displayText =
        displayValue !== undefined
            ? displayValue
            : formatValue
            ? formatValue(value)
            : value?.toString() ?? "--";

    if (editing) {
        return (
            <Spin
                spinning={saving}
                indicator={<LoadingOutlined spin />}
                size="small"
            >
                <div className="flex items-center gap-2 w-full">
                    {selectorType ? (
                        <FormDataSelector
                            type={selectorType}
                            value={inputValue}
                            onChange={(val) => handleValueChange(val)}
                            mode={mode} // Pass mode
                            className="flex-1 min-w-[200px]"
                            disabled={saving || loading}
                            // autoFocus
                            // isOpen={true} // Add prop to force open if possible, but FormDataSelector wraps Select which has defaultOpen
                            // FormDataSelector doesn't have autoFocus prop, but Select has.
                            // We might need to handle focus or defaultOpen in FormDataSelector
                        />
                    ) : fieldType === "number" ? (
                        <Input
                            type="number"
                            value={inputValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus
                            className="flex-1"
                            disabled={saving || loading}
                        />
                    ) : fieldType === "email" ? (
                        <Input
                            type="email"
                            value={inputValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus
                            className="flex-1"
                            disabled={saving || loading}
                        />
                    ) : fieldType === "phone" ? (
                        (() => {
                            // Helper function to extract and validate country code
                            const getCountryFromPhoneNumber = (phoneStr: string): string => {
                                if (!phoneStr || typeof phoneStr !== "string" || !phoneStr.startsWith("+")) {
                                    return ""; // No country code to validate
                                }

                                // Extract potential country codes (1-4 digits after +)
                                const phoneWithoutPlus = phoneStr.substring(1);
                                
                                // Try to match country codes from longest to shortest (up to 4 digits)
                                for (let len = 4; len >= 1; len--) {
                                    const potentialCode = phoneWithoutPlus.substring(0, len);
                                    // Check if this code matches any country's phonecode
                                    const matchingCountry = countries.find(
                                        (country: any) => 
                                            country.phonecode?.toString() === potentialCode ||
                                            country.phonecode === parseInt(potentialCode, 10)
                                    );
                                    
                                    if (matchingCountry && matchingCountry.iso) {
                                        return matchingCountry.iso.toLowerCase();
                                    }
                                }
                                
                                // If no valid country code found, return Afghanistan as fallback
                                return "af";
                            };

                            // Determine country prop based on phone number
                            const countryProp = typeof inputValue === "string" && inputValue.startsWith("+")
                                ? getCountryFromPhoneNumber(inputValue)
                                : "";

                            return (
                                <PhoneInput
                                    value={
                                        // antd-phone-input accepts both PhoneNumber objects and strings
                                        // Pass string values directly (like "0909090900" or "+08144893734")
                                        typeof inputValue === "string" 
                                            ? inputValue 
                                            : (inputValue as PhoneNumber | undefined)
                                    }
                                    onChange={(val) => {
                                        // Always save as string to preserve the exact format
                                        // This bypasses country code validation and keeps the number as-is
                                        if (val && typeof val === "object" && "phoneNumber" in val) {
                                            // If PhoneNumber object is returned, reconstruct the full number
                                            const countryCode = val.countryCode || "";
                                            const phoneNum = val.phoneNumber || "";
                                            const areaCode = val.areaCode || "";
                                            // If original had + prefix, preserve it; otherwise just save the number
                                            const originalHasPlus = typeof inputValue === "string" && inputValue.startsWith("+");
                                            if (originalHasPlus && countryCode) {
                                                handleValueChange(`+${countryCode}${areaCode}${phoneNum}`);
                                            } else {
                                                handleValueChange(phoneNum || val);
                                            }
                                        } else if (typeof val === "string") {
                                            // Save string as-is (preserves + prefix and full format)
                                            handleValueChange(val);
                                        } else {
                                            handleValueChange(val);
                                        }
                                    }}
                                    onBlur={handleBlur}
                                    onKeyDown={handleKeyPress}
                                    placeholder={placeholder}
                                    className="flex-1"
                                    disabled={saving || loading}
                                    enableSearch
                                    allowClear
                                    // Set country to Afghanistan if country code is invalid, otherwise use detected country
                                    country={countryProp}
                                />
                            );
                        })()
                    ) : fieldType === "date" ? (
                        <Input
                            type="date"
                            value={inputValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus
                            className="flex-1"
                            disabled={saving || loading}
                        />
                    ) : fieldType === "select" ? (
                        <Select
                            value={inputValue}
                            onChange={(val) => handleValueChange(val)}
                            options={options}
                            className="flex-1 min-w-[120px]"
                            disabled={saving || loading}
                            defaultOpen
                            allowClear
                        />
                    ) : fieldType === "multiselect" ? (
                        <Select
                            value={inputValue}
                            onChange={(val) => handleValueChange(val)}
                            options={options}
                            mode="multiple"
                            className="flex-1 min-w-[200px]"
                            disabled={saving || loading}
                            defaultOpen
                            allowClear
                            placeholder="Select options..."
                        />
                    ) : fieldType === "boolean" ? (
                        <Select
                            value={inputValue}
                            onChange={(val) => handleValueChange(val)}
                            options={[
                                { label: "Yes", value: 1 },
                                { label: "No", value: 0 },
                            ]}
                            className="flex-1 min-w-[80px]"
                            disabled={saving || loading}
                            defaultOpen
                        />
                    ) : fieldType === "textarea" ? (
                        <Input.TextArea
                            value={inputValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSave();
                                } else if (e.key === "Escape") {
                                    handleCancel();
                                }
                            }}
                            autoFocus
                            className="flex-1"
                            disabled={saving || loading}
                            autoSize={{ minRows: 2, maxRows: 6 }}
                        />
                    ) : fieldType === "country" ? (
                        <Select
                            value={inputValue}
                            onChange={(val) => handleValueChange(val)}
                            className="flex-1 min-w-[200px]"
                            disabled={saving || loading}
                            defaultOpen
                            allowClear
                            showSearch
                            placeholder="Select country"
                            filterOption={(input, option) => {
                                const searchText = input.toLowerCase();
                                const countryValue = option?.value as string;
                                const country = countries?.find(
                                    (c: any) => c.nicename === countryValue
                                );

                                if (!country) return false;

                                // Search by nicename, name, iso, iso3, or nationality
                                return (
                                    country.nicename
                                        ?.toLowerCase()
                                        .includes(searchText) ||
                                    country.name
                                        ?.toLowerCase()
                                        .includes(searchText) ||
                                    country.iso
                                        ?.toLowerCase()
                                        .includes(searchText) ||
                                    country.iso3
                                        ?.toLowerCase()
                                        .includes(searchText) ||
                                    country.nationality
                                        ?.toLowerCase()
                                        .includes(searchText)
                                );
                            }}
                        >
                            {countries && countries.length > 0 ? (
                                countries.map((country: any) => (
                                    <Select.Option
                                        key={country.iso || country.id}
                                        value={country.nicename}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span
                                                className={`flag-icon flag-icon-${country.iso?.toLowerCase()} mr-1`}
                                            />
                                            {country.nicename}
                                            {country.nationality &&
                                                country.nationality !==
                                                    "unknown" && (
                                                    <span className="text-gray-500 text-xs">
                                                        ({country.nationality})
                                                    </span>
                                                )}
                                        </span>
                                    </Select.Option>
                                ))
                            ) : (
                                <Select.Option disabled value="">
                                    No countries available
                                </Select.Option>
                            )}
                        </Select>
                    ) : (
                        <Input
                            value={inputValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyPress}
                            autoFocus={!alwaysEditing}
                            className="flex-1"
                            disabled={saving || loading}
                        />
                    )}
                    {/* Hide individual Save/Cancel buttons when in alwaysEditing mode */}
                    {!alwaysEditing && (
                        <>
                            <CheckOutlined
                                onMouseDown={handleActionMouseDown}
                                onClick={
                                    saving || loading ? undefined : handleSave
                                }
                                className={`${
                                    saving || loading
                                        ? "cursor-not-allowed opacity-50 pointer-events-none"
                                        : "cursor-pointer text-green-600 hover:text-green-700"
                                }`}
                                aria-disabled={saving || loading}
                            />
                            <CloseOutlined
                                onMouseDown={handleActionMouseDown}
                                onClick={
                                    saving || loading ? undefined : handleCancel
                                }
                                className={`${
                                    saving || loading
                                        ? "cursor-not-allowed opacity-50 pointer-events-none"
                                        : "cursor-pointer text-red-600 hover:text-red-700"
                                }`}
                                aria-disabled={saving || loading}
                            />
                        </>
                    )}
                </div>
            </Spin>
        );
    }

    return (
        <Skeleton active loading={loading || saving} paragraph={{ rows: 1 }}>
            <div
                className={`group flex items-center justify-between gap-2 px-2 py-1 rounded transition-colors ${
                    canStartEditing ? "hover:bg-gray-50 cursor-pointer" : ""
                } ${
                    isLocked ? "cursor-not-allowed opacity-50" : ""
                } ${className}`}
                onDoubleClick={canStartEditing ? startEditing : undefined}
            >
                <Text className="flex-1 break-words">{displayText}</Text>
                {canStartEditing && (
                    <EditOutlined
                        className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            startEditing();
                        }}
                    />
                )}
            </div>
        </Skeleton>
    );
}
