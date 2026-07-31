// Right-panel form experience: inputs are always visible and ready to fill.
// Agent can Tab through fields rapidly during a live call — no click-to-activate.
//
// Reactivity model:
//   localValues (optimistic) ← updated immediately on every input change
//   visibility               ← derived from localValues, reacts instantly
//   onSave                   ← silent background confirmation; does NOT drive visibility
//   FormField.value prop     ← server-confirmed value only (for init + post-save sync)
//   FormField.localVal state ← what the input shows; only synced from prop on server confirm

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useCurrencies } from "@/Hooks/useFormData";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

// ─── Currency helpers ────────────────────────────────────────────────────────


export function parseCurrencyValue(
    rawValue: any,
    defaultCurrency: string,
): { amount: number | null; currency: string } {
    const fallback = { amount: null as null, currency: defaultCurrency };
    if (rawValue === null || rawValue === undefined) return fallback;
    if (typeof rawValue === "number") return { amount: rawValue, currency: defaultCurrency };
    let obj: any = rawValue;
    if (typeof rawValue === "string") {
        const n = Number(rawValue);
        if (!isNaN(n) && rawValue.trim() !== "") return { amount: n, currency: defaultCurrency };
        try { obj = JSON.parse(rawValue); } catch { return fallback; }
    }
    if (typeof obj === "number") return { amount: obj, currency: defaultCurrency };
    if (obj && typeof obj === "object") {
        const amt = obj.amount !== undefined && obj.amount !== null && obj.amount !== ""
            ? Number(obj.amount) : null;
        return {
            amount: amt !== null && !isNaN(amt) ? amt : null,
            currency: String(obj.currency || defaultCurrency),
        };
    }
    return fallback;
}

export function InlineCurrencyInput({
    rawValue,
    canEdit,
    onChange,
    onSave,
}: {
    rawValue: any;
    canEdit: boolean;
    onChange: (val: { amount: number | null; currency: string }) => void;
    onSave: (val: { amount: number | null; currency: string }) => void;
}) {
    const { props } = usePage<any>();
    const defaultCurrency = (props.default_currency_code as string) || "TRY";
    const { currencies } = useCurrencies();

    const parsed = useMemo(() => parseCurrencyValue(rawValue, defaultCurrency), [rawValue, defaultCurrency]);
    const [amount, setAmount] = useState(() => parsed.amount !== null ? String(parsed.amount) : "");
    const [currency, setCurrency] = useState(() => parsed.currency);
    const [focused, setFocused] = useState(false);

    const prevRef = useRef(rawValue);
    useEffect(() => {
        if (prevRef.current !== rawValue) {
            prevRef.current = rawValue;
            const p = parseCurrencyValue(rawValue, defaultCurrency);
            setAmount(p.amount !== null ? String(p.amount) : "");
            setCurrency(p.currency);
        }
    }, [rawValue, defaultCurrency]);

    const build = (amt: string, cur: string) => ({
        amount: amt.trim() === "" ? null : (Number(amt) || null),
        currency: cur,
    });

    const focusRing: React.CSSProperties = focused ? FOCUSED_STYLE : {};
    const base: React.CSSProperties = { ...INPUT_BASE, ...focusRing };

    return (
        <div style={{ display: "flex", gap: 6 }}>
            <select
                value={currency}
                disabled={!canEdit}
                onChange={(e) => { setCurrency(e.target.value); onChange(build(amount, e.target.value)); }}
                style={{ ...base, width: 84, flexShrink: 0, cursor: canEdit ? "pointer" : "not-allowed", padding: "9px 6px" }}
            >
                {(currencies ?? []).map((c: any) => (
                    <option key={c.currency_code} value={c.currency_code}>
                        {c.currency_code}{c.currency_name ? ` — ${c.currency_name}` : ""}
                    </option>
                ))}
            </select>
            <input
                type="number"
                value={amount}
                disabled={!canEdit}
                placeholder="0"
                onChange={(e) => { setAmount(e.target.value); onChange(build(e.target.value, currency)); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                onFocus={() => setFocused(true)}
                onBlur={(e) => { setFocused(false); onSave(build(e.target.value, currency)); }}
                style={{ ...base, flex: 1, cursor: canEdit ? "text" : "not-allowed" }}
            />
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface FieldOption { value: string; label: string; }

function parseOptions(rawValues: any): FieldOption[] {
    if (!rawValues) return [];
    if (typeof rawValues === "string") {
        try { return parseOptions(JSON.parse(rawValues)); }
        catch {
            return rawValues.split(",").map((v: string) => v.trim()).filter(Boolean)
                .map((v: string) => ({ value: v, label: v }));
        }
    }
    if (Array.isArray(rawValues)) {
        return rawValues.map((v: any) => typeof v === "string"
            ? { value: v, label: v }
            : { value: String(v.value ?? v.id ?? v), label: String(v.label ?? v.name ?? v.value ?? v) });
    }
    if (typeof rawValues === "object") {
        return Object.entries(rawValues).map(([k, v]) => ({ value: k, label: String(v) }));
    }
    return [];
}

function toInputValue(type: string, rawValue: any): string | string[] {
    if (type === "checkbox" || type === "multiselect") {
        if (Array.isArray(rawValue)) return rawValue.map(String);
        if (typeof rawValue === "string") {
            try { return JSON.parse(rawValue); }
            catch { return rawValue.split(",").map((v: string) => v.trim()).filter(Boolean); }
        }
        return [];
    }
    if (type === "date" && rawValue) {
        try {
            const d = new Date(rawValue);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        } catch { return String(rawValue); }
    }
    if (rawValue === null || rawValue === undefined) return "";
    return String(rawValue);
}

/** Normalise an input value to what the visibility evaluator expects */
function toVisibilityValue(_type: string, val: any): any {
    if (Array.isArray(val)) return val.length > 0 ? val : null;
    if (typeof val === "string") return val.trim() === "" ? null : val;
    return val ?? null;
}

// ─── Single form field ───────────────────────────────────────────────────────

interface FieldProps {
    field: { id: number; label: string; type: string; values?: any };
    /** Server-confirmed value — used only for initialisation and post-save sync */
    value: any;
    saving: boolean;
    canEdit: boolean;
    /** Fires immediately on every change — for optimistic visibility in parent */
    onChange: (value: any) => void;
    /** Fires on blur / explicit Save — persists to server */
    onSave: (value: any) => void;
}

const LABEL_STYLE: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: T.TEXT_MUTED,
    marginBottom: 6,
};

const INPUT_BASE: React.CSSProperties = {
    width: "100%",
    border: `1.5px solid ${T.BORDER}`,
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 15,
    color: T.TEXT,
    fontFamily: "inherit",
    background: "#fff",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
};

const FOCUSED_STYLE: React.CSSProperties = {
    borderColor: T.BLUE_MID,
    boxShadow: `0 0 0 2.5px ${T.BLUE_LIGHT}`,
};

function FormField({ field, value: rawValue, saving, canEdit, onChange, onSave }: FieldProps) {
    const { td } = useTd();
    const options = useMemo(() => parseOptions(field.values), [field.values]);

    const [localVal, setLocalVal] = useState<string | string[]>(() =>
        toInputValue(field.type, rawValue),
    );
    const [focused, setFocused] = useState(false);

    // Sync from server value — only when rawValue changes (post-save confirmation).
    // We deliberately do NOT track localVal or onChange here, so typing never resets the input.
    const prevRawRef = useRef(rawValue);
    useEffect(() => {
        if (prevRawRef.current !== rawValue) {
            prevRawRef.current = rawValue;
            setLocalVal(toInputValue(field.type, rawValue));
        }
    }, [rawValue, field.type]);

    const notifyChange = useCallback(
        (val: any) => {
            onChange(toVisibilityValue(field.type, val));
        },
        [onChange, field.type],
    );

    const commit = useCallback(
        (val: any) => {
            let finalValue: any = val;
            if (typeof finalValue === "string" && finalValue.trim() === "") finalValue = null;
            if (Array.isArray(finalValue) && finalValue.length === 0) finalValue = null;
            onSave(finalValue);
        },
        [onSave],
    );

    const inputStyle: React.CSSProperties = {
        ...INPUT_BASE,
        ...(focused ? FOCUSED_STYLE : {}),
        cursor: canEdit ? "text" : "not-allowed",
    };

    const isText = ["text", "number", "phone", "email", "url"].includes(field.type);
    const isSelect = ["select", "radio"].includes(field.type);
    const isMulti = ["checkbox", "multiselect"].includes(field.type);

    return (
        <div style={{ marginBottom: 20 }}>
            <label style={LABEL_STYLE}>
                {field.label}
                {saving && (
                    <span style={{ marginLeft: 8, fontSize: 10, color: T.BLUE, fontWeight: 500, textTransform: "none" }}>
                        {td("Saving…")}
                    </span>
                )}
            </label>

            {/* Text / Number / Phone / Email / URL */}
            {isText && (
                <input
                    type={field.type === "number" ? "number" : "text"}
                    value={localVal as string}
                    disabled={!canEdit}
                    onChange={(e) => {
                        setLocalVal(e.target.value);
                        notifyChange(e.target.value); // immediate visibility update
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                    onFocus={() => setFocused(true)}
                    onBlur={(e) => { setFocused(false); commit(e.target.value); }}
                    placeholder={td("Fill in…")}
                    style={inputStyle}
                />
            )}

            {/* Textarea */}
            {field.type === "textarea" && (
                <textarea
                    value={localVal as string}
                    disabled={!canEdit}
                    rows={3}
                    onChange={(e) => {
                        setLocalVal(e.target.value);
                        notifyChange(e.target.value);
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={(e) => { setFocused(false); commit(e.target.value); }}
                    placeholder={td("Fill in…")}
                    style={{ ...inputStyle, resize: "vertical", cursor: canEdit ? "auto" : "not-allowed" }}
                />
            )}

            {/* Currency — proper selector + amount input */}
            {field.type === "currency" && (
                <InlineCurrencyInput
                    rawValue={rawValue}
                    canEdit={canEdit}
                    onChange={(val) => notifyChange(val)}
                    onSave={(val) => commit(val)}
                />
            )}

            {/* Date */}
            {field.type === "date" && (
                <input
                    type="date"
                    value={localVal as string}
                    disabled={!canEdit}
                    onChange={(e) => {
                        setLocalVal(e.target.value);
                        notifyChange(e.target.value);
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={(e) => { setFocused(false); commit(e.target.value); }}
                    style={{ ...inputStyle, cursor: canEdit ? "pointer" : "not-allowed" }}
                />
            )}

            {/* Select / Radio — saves immediately on change (no blur needed) */}
            {isSelect && (
                <select
                    value={localVal as string}
                    disabled={!canEdit}
                    onChange={(e) => {
                        const val = e.target.value;
                        setLocalVal(val);
                        notifyChange(val); // immediate visibility
                        commit(val);       // save in background
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={{ ...inputStyle, cursor: canEdit ? "pointer" : "not-allowed" }}
                >
                    <option value="">— {td("select")} —</option>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            )}

            {/* Checkbox / Multiselect — each toggle saves immediately, no Save button */}
            {isMulti && (
                <div
                    style={{
                        border: `1.5px solid ${T.BORDER}`,
                        borderRadius: 8,
                        padding: "10px 14px",
                        background: "#fff",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        maxHeight: 220,
                        overflowY: "auto",
                    }}
                >
                    {options.map((o) => {
                        const current = localVal as string[];
                        const checked = current.includes(o.value);
                        return (
                            <label
                                key={o.value}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    fontSize: 15,
                                    color: T.TEXT,
                                    cursor: canEdit ? "pointer" : "default",
                                    userSelect: "none",
                                    fontWeight: checked ? 500 : 400,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    disabled={!canEdit}
                                    checked={checked}
                                    style={{ accentColor: T.BLUE, width: 16, height: 16 }}
                                    onChange={() => {
                                        const next = checked
                                            ? current.filter((v) => v !== o.value)
                                            : [...current, o.value];
                                        setLocalVal(next);
                                        notifyChange(next);
                                        commit(next);
                                    }}
                                />
                                {o.label}
                            </label>
                        );
                    })}
                </div>
            )}

            {/* Fallback for unhandled types */}
            {!isText && !isSelect && !isMulti &&
             !["textarea", "date", "currency"].includes(field.type) && (
                <input
                    type="text"
                    value={localVal as string}
                    disabled={!canEdit}
                    onChange={(e) => {
                        setLocalVal(e.target.value);
                        notifyChange(e.target.value);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                    onFocus={() => setFocused(true)}
                    onBlur={(e) => { setFocused(false); commit(e.target.value); }}
                    placeholder={td("Fill in…")}
                    style={inputStyle}
                />
            )}
        </div>
    );
}

// ─── Form section (category → list of FormFields) ───────────────────────────

interface Props {
    fields: any[];
    categoryId?: number;
    values: Record<string, any>;
    canEdit: boolean;
    updatingField?: string | null;
    onSave: (fieldId: number, value: any) => void;
    /** Fires immediately on every change — for optimistic progress in parent */
    onChange?: (fieldId: number, value: any) => void;
}

export default function AnalysisCustomFieldForm({
    fields,
    categoryId,
    values,
    canEdit,
    updatingField,
    onSave,
    onChange,
}: Props) {
    const { td } = useTd();

    // Optimistic local values — updated immediately when any field changes.
    // Visibility is derived from this, not from the server-confirmed `values` prop.
    const [localValues, setLocalValues] = useState<Record<string, any>>(() => ({ ...values }));

    // Merge server-confirmed values in (post-save) without overwriting in-progress typing.
    useEffect(() => {
        setLocalValues((prev) => ({ ...prev, ...values }));
    }, [values]);

    const handleFieldChange = useCallback((fieldId: number, value: any) => {
        setLocalValues((prev) => ({ ...prev, [`field_${fieldId}`]: value }));
        onChange?.(fieldId, value);
    }, [onChange]);

    const scopedFields = useMemo(() => {
        let scoped = categoryId != null
            ? fields.filter((f: any) => f.custom_field_category_id === categoryId)
            : fields;
        return scoped.filter((f: any) => f.type !== "file");
    }, [fields, categoryId]);

    // Visibility reacts to localValues — instant, no server round-trip needed
    const visibleFields = useMemo(() => {
        const visibilityMap = evaluateAllFieldsVisibility(scopedFields, localValues);
        return scopedFields.filter((f: any) => visibilityMap[f.id] !== false);
    }, [scopedFields, localValues]);

    if (visibleFields.length === 0) {
        return (
            <p style={{ fontSize: 13, color: T.TEXT_HINT, fontStyle: "italic", margin: 0 }}>
                {td("No fields in this section.")}
            </p>
        );
    }

    return (
        <div>
            {visibleFields.map((field: any) => (
                <FormField
                    key={field.id}
                    field={field}
                    // Server value only — so post-save sync doesn't fight with typing
                    value={values[`field_${field.id}`] ?? null}
                    saving={updatingField === `field_${field.id}`}
                    canEdit={canEdit}
                    onChange={(value) => handleFieldChange(field.id, value)}
                    onSave={(value) => onSave(field.id, value)}
                />
            ))}
        </div>
    );
}

/** Returns the count of visible (non-file) fields and how many are filled. */
export function getCustomFieldCategoryProgress(
    fields: any[],
    categoryId: number,
    values: Record<string, any>,
): { total: number; filled: number } {
    const scoped = fields.filter(
        (f: any) => f.custom_field_category_id === categoryId && f.type !== "file",
    );
    const visibilityMap = evaluateAllFieldsVisibility(scoped, values);
    const visible = scoped.filter((f: any) => visibilityMap[f.id] !== false);

    const filled = visible.filter((f: any) => {
        const v = values[`field_${f.id}`];
        if (v === null || v === undefined || v === "") return false;
        if (Array.isArray(v)) return v.length > 0;
        return true;
    }).length;

    return { total: visible.length, filled };
}
