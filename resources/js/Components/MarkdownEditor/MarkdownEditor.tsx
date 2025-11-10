import React from "react";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import "./MarkdownEditor.css";

export interface MarkdownEditorProps {
    value?: string;
    onChange?: (value?: string) => void;
    placeholder?: string;
    preview?: "live" | "edit" | "preview";
    hideToolbar?: boolean;
    visibleDragbar?: boolean;
    height?: number;
    disabled?: boolean;
    readOnly?: boolean;
    className?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value = "",
    onChange,
    placeholder = "Start typing markdown...",
    preview = "live",
    hideToolbar = false,
    visibleDragbar = true,
    height = 300,
    disabled = false,
    readOnly = false,
    className = "",
}) => {
    const handleChange = (val?: string) => {
        if (onChange) {
            onChange(val || "");
        }
    };

    return (
        <div
            className={`markdown-editor-wrapper ${className} ${
                disabled ? "disabled" : ""
            } ${readOnly ? "readonly" : ""}`}
        >
            <MDEditor
                value={value}
                onChange={handleChange}
                preview={preview}
                hideToolbar={hideToolbar}
                visibleDragbar={visibleDragbar}
                height={height}
                data-color-mode="light"
                textareaProps={{
                    placeholder,
                    disabled: disabled || readOnly,
                    readOnly,
                    style: {
                        fontSize: 14,
                        lineHeight: 1.5,
                        fontFamily: "inherit",
                    },
                }}
            />
        </div>
    );
};

export default MarkdownEditor;
