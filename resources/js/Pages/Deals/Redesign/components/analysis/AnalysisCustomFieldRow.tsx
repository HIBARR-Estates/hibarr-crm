// Value-first custom field display with inline edit.
// Intentionally has no autoFocus on any input — never shifts scroll when a field becomes visible.

import { useCallback, useMemo, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { InlineCurrencyInput, parseCurrencyValue } from "./AnalysisCustomFieldForm";

interface FieldOption {
    value: string;
    label: string;
}

function parseOptions(rawValues: any): FieldOption[] {
    if (!rawValues) return [];
    if (typeof rawValues === "string") {
        try {
            return parseOptions(JSON.parse(rawValues));
        } catch {
            return rawValues
                .split(",")
                .map((v: string) => v.trim())
                .filter(Boolean)
                .map((v: string) => ({ value: v, label: v }));
        }
    }
    if (Array.isArray(rawValues)) {
        return rawValues.map((v: any) => {
            if (typeof v === "string") return { value: v, label: v };
            return {
                value: String(v.value ?? v.id ?? v),
                label: String(v.label ?? v.name ?? v.value ?? v),
            };
        });
    }
    if (typeof rawValues === "object") {
        return Object.entries(rawValues).map(([k, v]) => ({
            value: k,
            label: String(v),
        }));
    }
    return [];
}

function formatDisplay(type: string, rawValue: any, options: FieldOption[]): string {
    if (rawValue === null || rawValue === undefined || rawValue === "") return "";

    switch (type) {
        case "date":
            try {
                return new Date(rawValue).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                });
            } catch {
                return String(rawValue);
            }

        case "select":
        case "radio": {
            const found = options.find((o) => o.value === String(rawValue));
            return found ? found.label : String(rawValue);
        }

        case "checkbox":
        case "multiselect": {
            let arr: string[] = [];
            if (typeof rawValue === "string") {
                try {
                    arr = JSON.parse(rawValue);
                } catch {
                    arr = rawValue.split(",").map((v: string) => v.trim()).filter(Boolean);
                }
            } else if (Array.isArray(rawValue)) {
                arr = rawValue.map(String);
            }
            return arr
                .map((v) => {
                    const found = options.find((o) => o.value === v);
                    return found ? found.label : v;
                })
                .join(", ");
        }

        case "currency": {
            const p = parseCurrencyValue(rawValue, "");
            if (p.amount === null) return "";
            const formatted = p.amount.toLocaleString(undefined, { minimumFractionDigits: 0 });
            return p.currency ? `${p.currency} ${formatted}` : formatted;
        }

        case "boolean":
            return rawValue ? "Yes" : "No";

        default:
            return typeof rawValue === "object" ? JSON.stringify(rawValue) : String(rawValue);
    }
}

function toEditValue(type: string, rawValue: any): string | string[] {
    if (type === "checkbox" || type === "multiselect") {
        if (Array.isArray(rawValue)) return rawValue.map(String);
        if (typeof rawValue === "string") {
            try {
                return JSON.parse(rawValue);
            } catch {
                return rawValue.split(",").map((v: string) => v.trim()).filter(Boolean);
            }
        }
        return [];
    }
    if (type === "date" && rawValue) {
        try {
            const d = new Date(rawValue);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd}`;
        } catch {
            return String(rawValue);
        }
    }
    if (rawValue === null || rawValue === undefined) return "";
    return String(rawValue);
}

interface Props {
    field: {
        id: number;
        label: string;
        type: string;
        values?: any;
    };
    value: any;
    saving?: boolean;
    canEdit?: boolean;
    /** Fires immediately on every change — for optimistic visibility in parent */
    onChange?: (value: any) => void;
    onSave: (value: any) => void;
}

const MULTI_TYPES = ["checkbox", "multiselect"] as const;
const SELECT_TYPES = ["select", "radio"] as const;
const TEXT_TYPES = ["text", "number", "phone", "email", "url"] as const;

export default function AnalysisCustomFieldRow({
    field,
    value: rawValue,
    saving = false,
    canEdit = true,
    onChange,
    onSave,
}: Props) {
    const { td } = useTd();
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState<string | string[]>("");

    const options = useMemo(() => parseOptions(field.values), [field.values]);
    const displayValue = useMemo(
        () => formatDisplay(field.type, rawValue, options),
        [field.type, rawValue, options],
    );
    const isEmpty = displayValue === "";

    const isMultiType = (MULTI_TYPES as readonly string[]).includes(field.type);
    const isSelectType = (SELECT_TYPES as readonly string[]).includes(field.type);

    const startEdit = useCallback(() => {
        if (!canEdit) return;
        setEditVal(toEditValue(field.type, rawValue));
        setEditing(true);
    }, [canEdit, field.type, rawValue]);

    const commit = useCallback(
        (val?: any) => {
            setEditing(false);
            let finalValue: any = val !== undefined ? val : editVal;
            if (typeof finalValue === "string" && finalValue.trim() === "") finalValue = null;
            if (Array.isArray(finalValue) && finalValue.length === 0) finalValue = null;
            onSave(finalValue);
        },
        [editVal, onSave],
    );

    const cancel = useCallback(() => {
        setEditing(false);
        setEditVal(toEditValue(field.type, rawValue));
    }, [field.type, rawValue]);

    const handleCheckboxToggle = (optVal: string) => {
        const arr = Array.isArray(editVal) ? editVal : [];
        const next = arr.includes(optVal) ? arr.filter((v) => v !== optVal) : [...arr, optVal];
        setEditVal(next);
        onChange?.(next.length > 0 ? next : null);
        // save immediately without closing — user may still be ticking boxes
        const finalValue = next.length > 0 ? next : null;
        onSave(finalValue);
    };

    const baseInputStyle: React.CSSProperties = {
        width: "100%",
        border: `1px solid ${T.BLUE_MID}`,
        borderRadius: 6,
        padding: "7px 10px",
        fontSize: 15,
        color: T.TEXT,
        fontFamily: "inherit",
        outline: "none",
        background: "#fff",
        boxShadow: `0 0 0 2px ${T.BLUE_LIGHT}`,
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Read mode — horizontal label/value identical to profileRows */}
            {!editing && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        cursor: canEdit ? "pointer" : "default",
                        borderRadius: 4,
                        padding: "1px 0",
                        transition: "background 0.12s",
                    }}
                    onClick={canEdit ? startEdit : undefined}
                    role={canEdit ? "button" : undefined}
                    tabIndex={canEdit ? 0 : undefined}
                    aria-label={canEdit ? `${field.label}: ${isEmpty ? "empty, click to fill" : displayValue + ", click to edit"}` : undefined}
                    onKeyDown={canEdit ? (e) => { if (e.key === "Enter" || e.key === " ") startEdit(); } : undefined}
                    onMouseEnter={(e) => { if (canEdit) (e.currentTarget as HTMLElement).style.background = T.SURFACE_2; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                    <span style={{ fontSize: 12, color: T.TEXT_MUTED, flexShrink: 0, minWidth: 80 }}>
                        {field.label}
                    </span>
                    <span
                        style={{
                            fontSize: 14,
                            color: isEmpty ? T.TEXT_HINT : T.TEXT,
                            fontWeight: isEmpty ? 400 : 500,
                            fontStyle: isEmpty ? "italic" : "normal",
                            textAlign: "right",
                            wordBreak: "break-word",
                            flex: 1,
                        }}
                    >
                        {saving ? td("Saving…") : isEmpty ? "—" : displayValue}
                    </span>
                </div>
            )}

            {/* Edit mode — expands below the label/value row */}
            {editing && (
                <>
                    {/* Label stays visible above the input */}
                    <div style={{ fontSize: 12, color: T.TEXT_MUTED, marginBottom: 4 }}>
                        {field.label}
                    </div>
                    <div>
                    {/* Text / Number / Email / Phone / URL */}
                    {(TEXT_TYPES as readonly string[]).includes(field.type) && (
                        <input
                            type={field.type === "number" ? "number" : "text"}
                            value={editVal as string}
                            onChange={(e) => { setEditVal(e.target.value); onChange?.(e.target.value || null); }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); commit(); }
                                if (e.key === "Escape") { e.preventDefault(); cancel(); }
                            }}
                            onBlur={() => commit()}
                            style={baseInputStyle}
                        />
                    )}

                    {/* Textarea */}
                    {field.type === "textarea" && (
                        <textarea
                            value={editVal as string}
                            rows={3}
                            onChange={(e) => { setEditVal(e.target.value); onChange?.(e.target.value || null); }}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") { e.preventDefault(); cancel(); }
                            }}
                            onBlur={() => commit()}
                            style={{ ...baseInputStyle, resize: "vertical" }}
                        />
                    )}

                    {/* Currency */}
                    {field.type === "currency" && (
                        <input
                            type="text"
                            value={editVal as string}
                            placeholder="USD|1000"
                            onChange={(e) => { setEditVal(e.target.value); onChange?.(e.target.value || null); }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); commit(); }
                                if (e.key === "Escape") { e.preventDefault(); cancel(); }
                            }}
                            onBlur={() => commit()}
                            style={baseInputStyle}
                        />
                    )}

                    {/* Date */}
                    {field.type === "date" && (
                        <input
                            type="date"
                            value={editVal as string}
                            onChange={(e) => { setEditVal(e.target.value); onChange?.(e.target.value || null); }}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") { e.preventDefault(); cancel(); }
                            }}
                            onBlur={() => commit()}
                            style={baseInputStyle}
                        />
                    )}

                    {/* Currency — proper selector + amount input */}
                    {field.type === "currency" && (
                        <InlineCurrencyInput
                            rawValue={rawValue}
                            canEdit={canEdit ?? true}
                            onChange={(val) => onChange?.(val)}
                            onSave={(val) => commit(val)}
                        />
                    )}

                    {/* Select / Radio — saves immediately on change */}
                    {isSelectType && (
                        <select
                            value={editVal as string}
                            onChange={(e) => {
                                setEditVal(e.target.value);
                                onChange?.(e.target.value || null);
                                commit(e.target.value);
                            }}
                            style={{ ...baseInputStyle, cursor: "pointer" }}
                        >
                            <option value="">— {td("select")} —</option>
                            {options.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    )}

                    {/* Checkbox / Multiselect — each toggle saves immediately, Escape to close */}
                    {isMultiType && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 7,
                                padding: "10px 12px",
                                border: `1px solid ${T.BLUE_MID}`,
                                borderRadius: 6,
                                background: "#fff",
                                boxShadow: `0 0 0 2px ${T.BLUE_LIGHT}`,
                                maxHeight: 200,
                                overflowY: "auto",
                            }}
                            onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
                        >
                            {options.map((o) => (
                                <label
                                    key={o.value}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        fontSize: 14,
                                        color: T.TEXT,
                                        cursor: "pointer",
                                        userSelect: "none",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={(editVal as string[]).includes(o.value)}
                                        onChange={() => handleCheckboxToggle(o.value)}
                                        style={{ accentColor: T.BLUE }}
                                    />
                                    {o.label}
                                </label>
                            ))}
                        </div>
                    )}

                    {/* Fallback for unhandled types */}
                    {!isSelectType &&
                        !isMultiType &&
                        !(TEXT_TYPES as readonly string[]).includes(field.type) &&
                        field.type !== "textarea" &&
                        field.type !== "date" &&
                        field.type !== "currency" && (
                            <input
                                type="text"
                                value={editVal as string}
                                onChange={(e) => setEditVal(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); commit(); }
                                    if (e.key === "Escape") { e.preventDefault(); cancel(); }
                                }}
                                onBlur={() => commit()}
                                style={baseInputStyle}
                            />
                        )}
                </div>
                </>
            )}
        </div>
    );
}
