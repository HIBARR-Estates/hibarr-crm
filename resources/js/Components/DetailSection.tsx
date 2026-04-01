import React, { createContext, useState, useCallback, useMemo } from "react";
import { EditOutlined, CopyOutlined, CheckOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";

// ─── DetailFieldEditContext ────────────────────────────────────────────────────
// Lets a child EditableField register its startEditing fn so the parent
// DetailField can show the edit icon next to the label on hover.

interface DetailFieldEditContextValue {
    setEditHandler: (fn: (() => void) | null) => void;
    setIsEditing: (editing: boolean) => void;
}

export const DetailFieldEditContext =
    createContext<DetailFieldEditContextValue | null>(null);

// ─── DetailSection ─────────────────────────────────────────────────────────────
// A white, bordered card with an optional section heading.
// Fields are laid out in a 2-column grid by default.

interface DetailSectionProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
    /** Allow callers to override the inner grid class (e.g. for 1-col layouts) */
    gridClassName?: string;
}

export function DetailSection({
    title,
    children,
    className = "",
    gridClassName = "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5",
}: DetailSectionProps) {
    return (
        <div
            className={`bg-white border border-gray-100 rounded-xl overflow-hidden mb-4 last:mb-0 ${className}`}
        >
            {title && (
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/80">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {title}
                    </h3>
                </div>
            )}
            <div className={`px-4 py-3 ${gridClassName}`}>{children}</div>
        </div>
    );
}

// ─── DetailField ──────────────────────────────────────────────────────────────
// A label + value cell that lives inside a DetailSection grid.

interface DetailFieldProps {
    label: string;
    children: React.ReactNode;
    /** When 2, the field spans the full row (both columns) */
    span?: 1 | 2;
    className?: string;
    /** Plain-text value to copy to clipboard on icon click (e.g. email, phone) */
    copyValue?: string;
}

export function DetailField({
    label,
    children,
    span = 1,
    className = "",
    copyValue,
}: DetailFieldProps) {
    // editHandler is registered by a child EditableField via context
    const [editHandler, setEditHandlerState] = useState<(() => void) | null>(null);
    const [isFieldEditing, setIsFieldEditing] = useState(false);
    const [copied, setCopied] = useState(false);

    // Stable setters so child effects don't cause re-render loops
    const setEditHandler = useCallback((fn: (() => void) | null) => {
        setEditHandlerState(() => fn ?? null);
    }, []);

    const setIsEditing = useCallback((editing: boolean) => {
        setIsFieldEditing(editing);
    }, []);

    const handleCopy = useCallback(() => {
        if (!copyValue) return;
        if (typeof window !== 'undefined' && navigator?.clipboard) {
            navigator.clipboard.writeText(copyValue).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            }).catch(() => {
                fallbackCopy(copyValue);
            });
        } else {
            fallbackCopy(copyValue);
        }
    }, [copyValue]);

    const fallbackCopy = (text: string) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // silent fail
        }
    };

    const ctx = useMemo(
        () => ({ setEditHandler, setIsEditing }),
        [setEditHandler, setIsEditing]
    );

    return (
        <DetailFieldEditContext.Provider value={ctx}>
            <div
                className={`group flex flex-col gap-1 min-w-0 ${
                    span === 2 ? "sm:col-span-2" : ""
                } ${className}`}
            >
                {/* Label row — edit pencil appears here on group hover */}
                <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 leading-none">
                        {label}
                    </span>
                    {editHandler && (
                        <EditOutlined
                            className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm cursor-pointer"
                            onClick={() => editHandler()}
                        />
                    )}
                </div>

                {/* Value area — full width, no truncation */}
                <div className="text-[15px] text-gray-900 min-h-[1.5rem] flex items-start gap-1.5">
                    <div className="w-full min-w-0 flex items-center gap-1">
                        {children}
                        {copyValue && !isFieldEditing && (
                            <Tooltip title={copied ? "Copied!" : "Copy"}>
                                {copied ? (
                                    <CheckOutlined className="text-green-500 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                ) : (
                                    <CopyOutlined
                                        className="text-gray-400 hover:text-gray-600 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0"
                                        onClick={handleCopy}
                                    />
                                )}
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div>
        </DetailFieldEditContext.Provider>
    );
}
