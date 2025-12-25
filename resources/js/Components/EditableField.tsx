import { useState } from "react";
import { Input, Typography, message } from "antd";
import { router } from "@inertiajs/react";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface EditableFieldProps {
    value: string | number | null | undefined;
    fieldName: string;
    fieldType?: "text" | "email" | "number" | "date";
    onSave: (value: string) => Promise<void>;
    displayValue?: string;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    formatValue?: (value: string | number | null | undefined) => string;
}

export default function EditableField({
    value,
    fieldName,
    fieldType = "text",
    onSave,
    displayValue,
    placeholder = "Click to edit",
    className = "",
    disabled = false,
    formatValue,
}: EditableFieldProps) {
    const [editing, setEditing] = useState(false);
    const [inputValue, setInputValue] = useState(
        value?.toString() || ""
    );
    const [saving, setSaving] = useState(false);

    const handleDoubleClick = () => {
        if (disabled) return;
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
            <div className="flex items-center gap-2">
                {fieldType === "number" ? (
                    <Input
                        type="number"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyPress}
                        autoFocus
                        className="flex-1"
                        disabled={saving}
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
                        disabled={saving}
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
                        disabled={saving}
                    />
                ) : (
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyPress}
                        autoFocus
                        className="flex-1"
                        disabled={saving}
                    />
                )}
                <CheckOutlined
                    onClick={handleSave}
                    className="cursor-pointer text-green-600 hover:text-green-700"
                    disabled={saving}
                />
                <CloseOutlined
                    onClick={handleCancel}
                    className="cursor-pointer text-red-600 hover:text-red-700"
                    disabled={saving}
                />
            </div>
        );
    }

    return (
        <Text
            onDoubleClick={handleDoubleClick}
            className={`cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors ${
                disabled ? "cursor-not-allowed opacity-50" : ""
            } ${className}`}
            title={disabled ? "" : "Double-click to edit"}
        >
            {displayText}
        </Text>
    );
}

