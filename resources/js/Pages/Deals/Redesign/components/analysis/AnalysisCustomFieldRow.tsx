import { useCallback, useMemo, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { parseCurrencyValue } from "./AnalysisCustomFieldForm";
import DateInput from "./inputs/DateInput";
import SelectInput from "./inputs/SelectInput";
import RadioInput from "./inputs/RadioInput";
import CountrySelectInput from "./inputs/CountrySelectInput";
import CountryMultiSelectInput from "./inputs/CountryMultiSelectInput";
import PhoneInput from "./inputs/PhoneInput";
import CurrencyInput from "./inputs/CurrencyInput";

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
        case "multiselect":
        case "multiSelectCountry": {
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
            if (type === "multiSelectCountry") return arr.join(", ");
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

        case "country":
            return String(rawValue);

        case "phone": {
            const s = String(rawValue);
            if (s.includes("|")) {
                const [dial, num] = s.split("|");
                return `${dial} ${num}`.trim();
            }
            return s;
        }

        default:
            return typeof rawValue === "object" ? JSON.stringify(rawValue) : String(rawValue);
    }
}

function toEditValue(type: string, rawValue: any): string | string[] {
    if (type === "currency") {
        const p = parseCurrencyValue(rawValue, "GBP");
        return `${p.currency}|${p.amount ?? ""}`;
    }
    if (type === "checkbox" || type === "multiselect" || type === "multiSelectCountry") {
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
    onChange?: (value: any) => void;
    onSave: (value: any) => void;
}

const TEXT_TYPES = ["text", "number", "email", "url"] as const;
const MULTI_TYPES = ["checkbox", "multiselect"] as const;

function SaveCancel({ onSave, onCancel, td }: { onSave: () => void; onCancel: () => void; td: (s: string) => string }) {
    return (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
                type="button"
                onClick={onSave}
                className="dr-btn dr-btn-primary dr-btn-sm"
                style={{ fontSize: 11, padding: "3px 10px" }}
            >
                {td("Save")} ↵
            </button>
            <button
                type="button"
                onClick={onCancel}
                className="dr-btn dr-btn-ghost dr-btn-sm"
                style={{ fontSize: 11, padding: "3px 10px" }}
            >
                {td("Cancel")}
            </button>
        </div>
    );
}

function pipeToAmountObj(val: string): { amount: number | null; currency: string } {
    const [code = "GBP", rawAmt = ""] = val.split("|");
    const digits = rawAmt.replace(/[^0-9.]/g, "");
    return { amount: digits ? Number(digits) : null, currency: code };
}

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
    const portalFieldWrapperRef = useRef<HTMLDivElement>(null);

    const options = useMemo(() => parseOptions(field.values), [field.values]);
    const displayValue = useMemo(
        () => formatDisplay(field.type, rawValue, options),
        [field.type, rawValue, options],
    );
    const isEmpty = displayValue === "";

    const isText = (TEXT_TYPES as readonly string[]).includes(field.type);
    const isMultiType = (MULTI_TYPES as readonly string[]).includes(field.type);

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

    const handleCheckboxToggle = useCallback(
        (optVal: string) => {
            const arr = Array.isArray(editVal) ? editVal : [];
            const next = arr.includes(optVal) ? arr.filter((v) => v !== optVal) : [...arr, optVal];
            setEditVal(next);
            onChange?.(next.length > 0 ? next : null);
            commit(next.length > 0 ? next : null);
        },
        [editVal, onChange, commit],
    );

    const baseInputStyle: React.CSSProperties = {
        width: "100%",
        border: `1px solid ${T.BLUE_MID}`,
        borderRadius: 6,
        padding: "7px 10px",
        fontSize: 14,
        color: T.TEXT,
        fontFamily: "inherit",
        outline: "none",
        background: "#fff",
        boxShadow: `0 0 0 2px ${T.BLUE_LIGHT}`,
    };

    return (
        <div>
            {/* ── Read mode ── */}
            {!editing && (
                <div
                    className="group"
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        cursor: canEdit ? "pointer" : "default",
                        borderRadius: 4,
                        padding: "2px 0",
                        transition: "background 0.12s",
                    }}
                    onClick={canEdit ? startEdit : undefined}
                    role={canEdit ? "button" : undefined}
                    tabIndex={canEdit ? 0 : undefined}
                    aria-label={
                        canEdit
                            ? `${field.label}: ${isEmpty ? "empty, click to fill" : displayValue + ", click to edit"}`
                            : undefined
                    }
                    onKeyDown={
                        canEdit
                            ? (e) => { if (e.key === "Enter" || e.key === " ") startEdit(); }
                            : undefined
                    }
                    onMouseEnter={(e) => { if (canEdit) (e.currentTarget as HTMLElement).style.background = T.SURFACE_2; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                    <span style={{ fontSize: 12, color: T.TEXT_MUTED, flexShrink: 0, minWidth: 80, paddingTop: 1 }}>
                        {field.label}
                    </span>
                    <span
                        style={{
                            fontSize: 13,
                            color: isEmpty ? T.TEXT_HINT : T.TEXT,
                            fontWeight: isEmpty ? 400 : 500,
                            fontStyle: isEmpty ? "italic" : "normal",
                            wordBreak: "break-word",
                            flex: 1,
                            textAlign: "right",
                        }}
                    >
                        {isEmpty ? "—" : displayValue}
                    </span>
                    {canEdit && (
                        <svg
                            className="opacity-0 group-hover:opacity-100 w-3.5 h-3.5 shrink-0 transition-opacity"
                            style={{ color: T.TEXT_MUTED, marginTop: 2 }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                        </svg>
                    )}
                </div>
            )}

            {/* ── Edit mode ── */}
            {editing && (
                <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
                        {field.label}
                    </div>

                    {/* Text / Number / Phone / Email / URL — explicit Save/Cancel */}
                    {isText && (
                        <>
                            <input
                                type={field.type === "number" ? "number" : "text"}
                                value={editVal as string}
                                onChange={(e) => { setEditVal(e.target.value); onChange?.(e.target.value || null); }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); commit(); }
                                    if (e.key === "Escape") { e.preventDefault(); cancel(); }
                                }}
                                style={baseInputStyle}
                                // ponytail: no autoFocus — never shifts scroll when a field opens
                            />
                            <SaveCancel onSave={() => commit()} onCancel={cancel} td={td} />
                        </>
                    )}

                    {/* Textarea — explicit Save/Cancel */}
                    {field.type === "textarea" && (
                        <>
                            <textarea
                                value={editVal as string}
                                rows={3}
                                onChange={(e) => { setEditVal(e.target.value); onChange?.(e.target.value || null); }}
                                onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } }}
                                style={{ ...baseInputStyle, resize: "vertical" }}
                            />
                            <SaveCancel onSave={() => commit()} onCancel={cancel} td={td} />
                        </>
                    )}

                    {/* Phone — flag + dial code picker, explicit Save/Cancel */}
                    {field.type === "phone" && (
                        <>
                            <div ref={portalFieldWrapperRef}>
                                <PhoneInput
                                    value={editVal as string}
                                    onChange={(val) => { setEditVal(val); onChange?.(val || null); }}
                                />
                            </div>
                            <SaveCancel onSave={() => commit()} onCancel={cancel} td={td} />
                        </>
                    )}

                    {/* Currency — code picker + amount, explicit Save/Cancel */}
                    {field.type === "currency" && (
                        <>
                            <div ref={portalFieldWrapperRef}>
                                <CurrencyInput
                                    value={editVal as string}
                                    onChange={(val) => {
                                        setEditVal(val);
                                        onChange?.(pipeToAmountObj(val));
                                    }}
                                />
                            </div>
                            <SaveCancel onSave={() => commit(pipeToAmountObj(editVal as string))} onCancel={cancel} td={td} />
                        </>
                    )}

                    {/* Date — DateInput, auto-saves on pick */}
                    {field.type === "date" && (
                        <DateInput
                            value={editVal as string}
                            onChange={(val) => {
                                onChange?.(val || null);
                                commit(val);
                            }}
                        />
                    )}

                    {/* Select — portal dropdown, auto-saves on pick */}
                    {field.type === "select" && (
                        <SelectInput
                            value={editVal as string}
                            options={options}
                            onChange={(val) => {
                                onChange?.(val || null);
                                commit(val);
                            }}
                        />
                    )}

                    {/* Radio — pill buttons, auto-saves on pick */}
                    {field.type === "radio" && (
                        <RadioInput
                            value={editVal as string}
                            options={options}
                            onChange={(val) => {
                                onChange?.(val || null);
                                commit(val);
                            }}
                        />
                    )}

                    {/* Country — single country select, auto-saves on pick */}
                    {field.type === "country" && (
                        <CountrySelectInput
                            value={editVal as string}
                            onChange={(val) => {
                                onChange?.(val || null);
                                commit(val);
                            }}
                        />
                    )}

                    {/* Country multiselect — auto-saves on each toggle */}
                    {field.type === "multiSelectCountry" && (
                        <CountryMultiSelectInput
                            value={editVal as string[]}
                            onChange={(val) => {
                                setEditVal(val);
                                onChange?.(val.length > 0 ? val : null);
                                commit(val.length > 0 ? val : null);
                            }}
                        />
                    )}

                    {/* Checkbox / Multiselect — each toggle saves immediately */}
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
                                        fontSize: 13,
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
                </div>
            )}
        </div>
    );
}
