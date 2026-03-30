import React, { createContext, useState, useCallback } from "react";
import { EditOutlined } from "@ant-design/icons";

// ─── DetailFieldEditContext ────────────────────────────────────────────────────
// Lets a child EditableField register its startEditing fn so the parent
// DetailField can show the edit icon next to the label on hover.

interface DetailFieldEditContextValue {
    setEditHandler: (fn: (() => void) | null) => void;
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
    gridClassName = "grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5",
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
            <div className={`px-5 py-4 ${gridClassName}`}>{children}</div>
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
}

export function DetailField({
    label,
    children,
    span = 1,
    className = "",
}: DetailFieldProps) {
    // editHandler is registered by a child EditableField via context
    const [editHandler, setEditHandlerState] = useState<(() => void) | null>(null);

    // Stable setter so the child effect doesn't cause re-render loops
    const setEditHandler = useCallback((fn: (() => void) | null) => {
        setEditHandlerState(() => fn ?? null);
    }, []);

    return (
        <DetailFieldEditContext.Provider value={{ setEditHandler }}>
            <div
                className={`group flex flex-col gap-1 min-w-0 ${
                    span === 2 ? "sm:col-span-2" : ""
                } ${className}`}
            >
                {/* Label row — edit pencil appears here on group hover */}
                <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 leading-none">
                        {label}
                    </span>
                    {editHandler && (
                        <EditOutlined
                            className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] cursor-pointer"
                            onClick={() => editHandler()}
                        />
                    )}
                </div>

                {/* Value area — full width, no truncation */}
                <div className="text-sm text-gray-800 min-h-[1.5rem]">
                    {children}
                </div>
            </div>
        </DetailFieldEditContext.Provider>
    );
}
