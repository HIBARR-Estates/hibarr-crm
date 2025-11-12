import React, { useMemo } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import "./HtmlEditor.css";

export interface HtmlEditorProps {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    disabled?: boolean;
    height?: number;
    className?: string;
}

const HtmlEditor: React.FC<HtmlEditorProps> = ({
    value = "",
    onChange,
    placeholder = "Start typing...",
    readOnly = false,
    disabled = false,
    height = 200,
    className = "",
}) => {
    const modules = useMemo(
        () => ({
            toolbar: [
                [{ header: [1, 2, 3, false] }],
                ["bold", "italic", "underline", "strike"],
                [{ color: [] }, { background: [] }],
                [{ list: "ordered" }, { list: "bullet" }],
                [{ indent: "-1" }, { indent: "+1" }],
                [{ align: [] }],
                ["link", "image"],
                ["blockquote", "code-block"],
                ["clean"],
            ],
        }),
        []
    );

    const formats = [
        "header",
        "bold",
        "italic",
        "underline",
        "strike",
        "color",
        "background",
        "list",
        "bullet",
        "indent",
        "align",
        "link",
        "image",
        "blockquote",
        "code-block",
    ];

    return (
        <div
            className={`html-editor ${className} ${disabled ? "disabled" : ""}`}
        >
            <ReactQuill
                theme="snow"
                value={value}
                onChange={onChange}
                modules={modules}
                formats={formats}
                placeholder={placeholder}
                readOnly={readOnly || disabled}
                style={{ height: `${height}px` }}
            />
        </div>
    );
};

export default HtmlEditor;
