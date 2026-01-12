import { useState } from "react";
import { Input, Typography, message, Select, Skeleton } from "antd";
import { CheckOutlined, CloseOutlined, EditOutlined } from "@ant-design/icons";
import FormDataSelector from "./FormDataSelector";
import { FormDataType } from "@/Hooks/useFormData";

const { Text } = Typography;

interface EditableFieldProps {
    value: string | number | null | undefined | any[]; // Updated to accept array
    fieldName: string;
    fieldType?:
        | "text"
        | "email"
        | "number"
        | "date"
        | "select"
        | "boolean"
        | "textarea";
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
}: EditableFieldProps) {
    const [editing, setEditing] = useState(false);
    const [inputValue, setInputValue] = useState<any>(value);
    const [saving, setSaving] = useState(false);

    const isLocked = disabled || loading || saving;

    const startEditing = () => {
        if (isLocked) return;
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
        } else {
            setInputValue(value?.toString() || "");
        }
    };

    const handleSave = async () => {
        if (inputValue === (value?.toString() || "")) {
            setEditing(false);
            return;
        }

        setSaving(true);
        try {
            await onSave(inputValue);
            setEditing(false);
            message.success("Field updated successfully");
        } catch (error: any) {
            message.error(
                error?.message || "Failed to update field. Please try again."
            );
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditing(false);
        setInputValue(value?.toString() || "");
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            handleCancel();
        }
    };

    const displayText =
        displayValue !== undefined
            ? displayValue
            : formatValue
            ? formatValue(value)
            : value?.toString() || "--";

    if (editing) {
        return (
            <div className="flex items-center gap-2 w-full">
                {selectorType ? (
                    <FormDataSelector
                        type={selectorType}
                        value={inputValue}
                        onChange={(val) => setInputValue(val)}
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
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyPress}
                        autoFocus
                        className="flex-1"
                        disabled={saving || loading}
                    />
                ) : fieldType === "email" ? (
                    <Input
                        type="email"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyPress}
                        autoFocus
                        className="flex-1"
                        disabled={saving || loading}
                    />
                ) : fieldType === "date" ? (
                    <Input
                        type="date"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyPress}
                        autoFocus
                        className="flex-1"
                        disabled={saving || loading}
                    />
                ) : fieldType === "select" ? (
                    <Select
                        value={inputValue}
                        onChange={(val) => {
                            setInputValue(val);
                            // Auto save on select change? or wait for check?
                            // Wait for check usually better for consistent UX, but often Select is auto-save.
                            // Keeping consistent with others: require explicit save click or enter?
                            // Enter doesn't work well on Select.
                            // Let's rely on the check button.
                        }}
                        options={options}
                        className="flex-1 min-w-[120px]"
                        disabled={saving || loading}
                        defaultOpen
                        onBlur={() => {
                            // Delay to allow check button click
                            setTimeout(() => {
                                // handleSave(); // Optional: auto save on blur
                            }, 200);
                        }}
                    />
                ) : fieldType === "boolean" ? (
                    <Select
                        value={inputValue}
                        onChange={(val) => setInputValue(val)}
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
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleSave}
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
                ) : (
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyPress}
                        autoFocus
                        className="flex-1"
                        disabled={saving || loading}
                    />
                )}
                <CheckOutlined
                    onClick={saving || loading ? undefined : handleSave}
                    className={`${
                        saving || loading
                            ? "cursor-not-allowed opacity-50 pointer-events-none"
                            : "cursor-pointer text-green-600 hover:text-green-700"
                    }`}
                    aria-disabled={saving || loading}
                />
                <CloseOutlined
                    onClick={saving || loading ? undefined : handleCancel}
                    className={`${
                        saving || loading
                            ? "cursor-not-allowed opacity-50 pointer-events-none"
                            : "cursor-pointer text-red-600 hover:text-red-700"
                    }`}
                    aria-disabled={saving || loading}
                />
            </div>
        );
    }

    return (
        <Skeleton active loading={loading} paragraph={{ rows: 1 }}>
            <div
                className={`group flex items-center justify-between gap-2 px-2 py-1 rounded transition-colors hover:bg-gray-50 cursor-pointer ${
                    isLocked ? "cursor-not-allowed opacity-50" : ""
                } ${className}`}
                onDoubleClick={startEditing}
            >
                <Text className="flex-1 break-words">{displayText}</Text>
                {!isLocked && (
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
