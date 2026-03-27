import React from "react";

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
    return (
        <div
            className={`flex flex-col gap-1 min-w-0 ${
                span === 2 ? "sm:col-span-2" : ""
            } ${className}`}
        >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 leading-none">
                {label}
            </span>
            <div className="text-sm text-gray-800 break-words min-h-[1.5rem] flex items-start">
                {children}
            </div>
        </div>
    );
}
