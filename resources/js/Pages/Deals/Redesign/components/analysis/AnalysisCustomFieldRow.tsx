import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TdFn } from "@/lib/dynamicTranslation";
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

// Revamp §C.4 input class — sky ring, rounded-lg
const INPUT_CLS = "w-full bg-white border border-sky-400 ring-2 ring-sky-100 rounded-lg px-2 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-colors";

const LABEL_CLS = "w-[130px] shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-900 truncate";

function SaveCancel({ onSave, onCancel, td }: { onSave: () => void; onCancel: () => void; td: TdFn }) {
    return (
        <div className="flex items-center gap-2 mt-1.5">
            <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSave(); }}
                className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
                {td("Save", { source: "en" })} ↵
            </button>
            <span className="text-slate-300">·</span>
            <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onCancel(); }}
                className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
            >
                {td("Cancel", { source: "en" })}
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
    const editContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!editing) return;
        const c = editContainerRef.current;
        if (!c) return;
        const el = c.querySelector<HTMLElement>(
            'input:not([type="hidden"]):not([disabled]), textarea:not([disabled])'
        ) ?? c.querySelector<HTMLElement>('button:not([disabled])');
        // preventScroll is required: .analysis-modal-panel is overflow:hidden but
        // still scrollable programmatically, so a scroll-into-view here shifts the
        // header off-screen with no scrollbar to get it back.
        el?.focus({ preventScroll: true });
    }, [editing]);

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

    return (
        <div>
            {/* ── Read mode — revamp InlineField display shape ── */}
            {!editing && (
                <button
                    type="button"
                    onClick={startEdit}
                    disabled={!canEdit}
                    className="flex items-center gap-3 py-2 px-4 w-full text-left hover:bg-slate-50 group transition-colors disabled:hover:bg-transparent disabled:cursor-default"
                    aria-label={
                        canEdit
                            ? `${field.label}: ${isEmpty ? "empty, click to fill" : displayValue + ", click to edit"}`
                            : undefined
                    }
                >
                    <span className={LABEL_CLS}>{field.label}</span>
                    <span
                        className={`flex-1 text-sm min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${
                            isEmpty ? "text-slate-300" : "text-slate-800 font-medium"
                        }`}
                        title={isEmpty ? undefined : displayValue}
                    >
                        {isEmpty ? "—" : displayValue}
                    </span>
                    {canEdit && (
                        <svg
                            className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
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
                </button>
            )}

            {/* ── Edit mode — revamp InlineField edit shape ── */}
            {editing && (
                <div
                    ref={editContainerRef}
                    className="flex items-start gap-3 py-2 px-4"
                    onBlur={(e) => {
                        const rel = e.relatedTarget as Node | null;
                        if (e.currentTarget.contains(rel)) return;
                        // FloatingDropdown portals render outside the modal panel — focus landing
                        // there isn't a real blur. (Can't test document.body.lastElementChild:
                        // the modal is portaled to body too and is usually that element.)
                        const panel = e.currentTarget.closest(".analysis-modal-panel");
                        if (rel && panel && !panel.contains(rel)) return;
                        setEditing(false);
                        setEditVal(toEditValue(field.type, rawValue));
                    }}
                >
                    <span className={LABEL_CLS + " pt-1.5"}>{field.label}</span>
                    <div className="flex-1 min-w-0">

                        {/* Text / Number — explicit Save ↵ · Cancel */}
                        {isText && (
                            <>
                                <input
                                    type={field.type === "number" ? "number" : "text"}
                                    value={editVal as string}
                                    onChange={(e) => { setEditVal(e.target.value); onChange?.(e.target.value || null); }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") { e.preventDefault(); commit(); }
                                        // stopPropagation: Escape must cancel the edit, not reach the modal's close handler
                                        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
                                    }}
                                    className={INPUT_CLS}
                                />
                                <SaveCancel onSave={() => commit()} onCancel={cancel} td={td} />
                            </>
                        )}

                        {/* Textarea — explicit Save ↵ · Cancel */}
                        {field.type === "textarea" && (
                            <>
                                <textarea
                                    value={editVal as string}
                                    rows={3}
                                    onChange={(e) => { setEditVal(e.target.value); onChange?.(e.target.value || null); }}
                                    onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); } }}
                                    className={INPUT_CLS + " resize-none"}
                                />
                                <SaveCancel onSave={() => commit()} onCancel={cancel} td={td} />
                            </>
                        )}

                        {/* Phone — flag + dial code picker, explicit Save ↵ · Cancel */}
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

                        {/* Currency — code picker + amount, explicit Save ↵ · Cancel */}
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

                        {/* Date — auto-saves on pick */}
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

                        {/* Country — single select, auto-saves on pick */}
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
                            <div ref={portalFieldWrapperRef}>
                                <CountryMultiSelectInput
                                    value={editVal as string[]}
                                    onChange={(val) => {
                                        setEditVal(val);
                                        onChange?.(val.length > 0 ? val : null);
                                        commit(val.length > 0 ? val : null);
                                    }}
                                />
                            </div>
                        )}

                        {/* Checkbox / Multiselect — each toggle saves immediately */}
                        {isMultiType && (
                            <div
                                className="flex flex-wrap gap-x-3 gap-y-1.5 p-3 border border-sky-400 ring-2 ring-sky-100 rounded-lg bg-white max-h-48 overflow-y-auto"
                                onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); } }}
                            >
                                {options.map((o) => (
                                    <label
                                        key={o.value}
                                        className="inline-flex items-center gap-2 text-sm text-slate-800 cursor-pointer select-none max-w-full"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={(editVal as string[]).includes(o.value)}
                                            onChange={() => handleCheckboxToggle(o.value)}
                                            className="accent-sky-500"
                                        />
                                        {o.label}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
