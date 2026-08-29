// Right-panel form experience: inputs are always visible and ready to fill.
// Agent can Tab through fields rapidly during a live call — no click-to-activate.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import AnalysisFieldRow from "./center/AnalysisFieldRow";
import DateInput from "./inputs/DateInput";
import SelectInput from "./inputs/SelectInput";
import RadioInput from "./inputs/RadioInput";
import CountrySelectInput from "./inputs/CountrySelectInput";
import CountryMultiSelectInput from "./inputs/CountryMultiSelectInput";
import PhoneInput from "./inputs/PhoneInput";
import CurrencyInput from "./inputs/CurrencyInput";
import CurrencyRangeInput from "./inputs/CurrencyRangeInput";
import NumberInput from "./inputs/NumberInput";
import NumberRangeInput from "./inputs/NumberRangeInput";
import PasswordInput from "./inputs/PasswordInput";
import CheckboxInput from "./inputs/CheckboxInput";
import MultiSelectInput from "./inputs/MultiSelectInput";
import FileInput from "./inputs/FileInput";
import {
    parseOptions,
    toInputValue,
    toSaveValue,
    pipeToAmountObj,
    pipeToCurrencyRangeObj,
    pipeToRangeObj,
    pipePhoneToPlain,
} from "./inputs/fieldValueCodecs";
import { A } from "./analysisTokens";

// ─── Currency helper (kept for external callers like DealAnalysisModal) ──────

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

// ─── Single form field ───────────────────────────────────────────────────────

interface FieldProps {
    field: { id: number; label: string; type: string; values?: any };
    value: any;
    fieldNumber?: number;
    canEdit: boolean;
    onChange: (value: any) => void;
    onSave: (value: any) => void;
    onFileSelect?: (fieldId: number, file: File) => void;
}

const INPUT_BASE: React.CSSProperties = {
    width: "100%",
    border: `1.5px solid ${A.BORDER}`,
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 15,
    color: A.TEXT,
    fontFamily: "inherit",
    background: "#fff",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
};

const FOCUSED_STYLE: React.CSSProperties = {
    borderColor: "#38bdf8",
    boxShadow: "0 0 0 2.5px #e0f2fe",
};

function isFieldFilled(value: unknown): boolean {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

/**
 * One custom field input, including its numbered row shell. Exported so a script
 * can place individual custom fields inline among questions/native fields, where
 * they must interleave in author order rather than render as a whole category.
 */
export function FormField({ field, value: rawValue, fieldNumber, canEdit, onChange, onSave, onFileSelect }: FieldProps) {
    const options = useMemo(() => parseOptions(field.values), [field.values]);
    const portalFieldWrapperRef = useRef<HTMLDivElement>(null);

    const [localVal, setLocalVal] = useState<string | string[]>(() =>
        toInputValue(field.type, rawValue),
    );
    const [focused, setFocused] = useState(false);

    const prevRawRef = useRef(rawValue);
    useEffect(() => {
        if (prevRawRef.current !== rawValue) {
            prevRawRef.current = rawValue;
            setLocalVal(toInputValue(field.type, rawValue));
        }
    }, [rawValue, field.type]);

    const notifyChange = useCallback(
        (val: any) => { onChange(val); },
        [onChange],
    );

    /** True when `next` (in input representation) differs from what's stored. */
    const changedFromStored = useCallback(
        (next: string | string[]) =>
            JSON.stringify(next) !== JSON.stringify(toInputValue(field.type, rawValue)),
        [field.type, rawValue],
    );

    const commit = useCallback(
        (val?: any) => {
            const finalVal = val !== undefined ? val : localVal;
            // Blur fires whether or not the agent touched the field, so without this
            // Tabbing through a section would PATCH every field it passed over.
            if (!changedFromStored(finalVal as string | string[])) return;
            onSave(toSaveValue(field.type, finalVal as string | string[]));
        },
        [localVal, onSave, field.type, changedFromStored],
    );

    const inputStyle: React.CSSProperties = {
        ...INPUT_BASE,
        ...(focused ? FOCUSED_STYLE : {}),
        cursor: canEdit ? "text" : "not-allowed",
    };

    const isText = ["text", "email", "url"].includes(field.type);
    const answered = isFieldFilled(rawValue);

    return (
        <AnalysisFieldRow number={fieldNumber} answered={answered} label={field.label}>

            {isText && (
                <input
                    type="text"
                    value={localVal as string}
                    disabled={!canEdit}
                    onChange={(e) => { setLocalVal(e.target.value); notifyChange(e.target.value || null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                    onFocus={() => setFocused(true)}
                    onBlur={(e) => { setFocused(false); commit(e.target.value); }}
                    placeholder={"Fill in…"}
                    style={inputStyle}
                />
            )}

            {field.type === "number" && (
                <NumberInput
                    value={localVal as string}
                    disabled={!canEdit}
                    onChange={(val) => { setLocalVal(val); notifyChange(val || null); }}
                    onCommit={(val) => commit(val)}
                />
            )}

            {field.type === "password" && (
                <PasswordInput
                    value={localVal as string}
                    disabled={!canEdit}
                    onChange={(val) => { setLocalVal(val); notifyChange(val || null); }}
                    onBlur={() => commit()}
                />
            )}

            {field.type === "textarea" && (
                <textarea
                    value={localVal as string}
                    disabled={!canEdit}
                    rows={3}
                    onChange={(e) => { setLocalVal(e.target.value); notifyChange(e.target.value || null); }}
                    onFocus={() => setFocused(true)}
                    onBlur={(e) => { setFocused(false); commit(e.target.value); }}
                    placeholder={"Fill in…"}
                    style={{ ...inputStyle, resize: "none", cursor: canEdit ? "auto" : "not-allowed" }}
                />
            )}

            {field.type === "phone" && (
                <div
                    ref={portalFieldWrapperRef}
                    onBlur={(e) => {
                        const next = e.relatedTarget as Element | null;
                        const inPortal = next && document.body.lastElementChild?.contains(next);
                        if (!inPortal && !portalFieldWrapperRef.current?.contains(next)) {
                            // Save plain concatenated number (no pipe) to match CRM storage
                            if (changedFromStored(localVal)) onSave(pipePhoneToPlain(localVal as string));
                        }
                    }}
                >
                    <PhoneInput
                        value={localVal as string}
                        onChange={(val) => {
                            setLocalVal(val);
                            notifyChange(pipePhoneToPlain(val) || null);
                        }}
                    />
                </div>
            )}

            {field.type === "currency" && (
                <div
                    ref={portalFieldWrapperRef}
                    // Code picker + amount doesn't need the full row width
                    className="w-1/2 min-w-[220px] max-w-full"
                    onBlur={(e) => {
                        const next = e.relatedTarget as Element | null;
                        const inPortal = next && document.body.lastElementChild?.contains(next);
                        if (!inPortal && !portalFieldWrapperRef.current?.contains(next)) {
                            if (changedFromStored(localVal)) onSave(pipeToAmountObj(localVal as string));
                        }
                    }}
                >
                    <CurrencyInput
                        value={localVal as string}
                        onChange={(val) => {
                            setLocalVal(val);
                            notifyChange(pipeToAmountObj(val));
                        }}
                    />
                </div>
            )}

            {field.type === "currency_range" && (
                <div
                    ref={portalFieldWrapperRef}
                    onBlur={(e) => {
                        const next = e.relatedTarget as Element | null;
                        const inPortal = next && document.body.lastElementChild?.contains(next);
                        if (!inPortal && !portalFieldWrapperRef.current?.contains(next)) {
                            if (changedFromStored(localVal)) onSave(pipeToCurrencyRangeObj(localVal as string));
                        }
                    }}
                >
                    <CurrencyRangeInput
                        value={localVal as string}
                        onChange={(val) => {
                            setLocalVal(val);
                            notifyChange(pipeToCurrencyRangeObj(val));
                        }}
                    />
                </div>
            )}

            {field.type === "range" && (
                <div
                    onBlur={(e) => {
                        const container = e.currentTarget;
                        if (!container.contains(e.relatedTarget as Node)) {
                            if (changedFromStored(localVal)) onSave(pipeToRangeObj(localVal as string));
                        }
                    }}
                >
                    <NumberRangeInput
                        value={localVal as string}
                        disabled={!canEdit}
                        onChange={(val) => {
                            setLocalVal(val);
                            notifyChange(pipeToRangeObj(val));
                        }}
                    />
                </div>
            )}

            {field.type === "date" && (
                <DateInput
                    value={localVal as string}
                    onChange={(val) => { setLocalVal(val); notifyChange(val); commit(val); }}
                />
            )}

            {field.type === "select" && (
                <SelectInput
                    value={localVal as string}
                    options={options}
                    placeholder={"Select…"}
                    onChange={(val) => { setLocalVal(val); notifyChange(val); commit(val); }}
                />
            )}

            {field.type === "radio" && (
                <RadioInput
                    value={localVal as string}
                    options={options}
                    onChange={(val) => { setLocalVal(val); notifyChange(val); commit(val); }}
                />
            )}

            {field.type === "country" && (
                <CountrySelectInput
                    value={localVal as string}
                    onChange={(val) => { setLocalVal(val); notifyChange(val); commit(val); }}
                />
            )}

            {/* Fixed: was "country-multiselect", real CRM type is "multiSelectCountry" */}
            {field.type === "multiSelectCountry" && (
                <CountryMultiSelectInput
                    value={localVal as string[]}
                    onChange={(val) => { setLocalVal(val); notifyChange(val.length > 0 ? val : null); commit(val.length > 0 ? val : null); }}
                />
            )}

            {field.type === "checkbox" && (
                <CheckboxInput
                    value={localVal as string[]}
                    options={options}
                    disabled={!canEdit}
                    onChange={(val) => {
                        setLocalVal(val);
                        notifyChange(val.length > 0 ? val : null);
                        onSave(val.length > 0 ? val : null);
                    }}
                />
            )}

            {field.type === "multiselect" && (
                <MultiSelectInput
                    value={localVal as string[]}
                    options={options}
                    disabled={!canEdit}
                    onChange={(val) => {
                        setLocalVal(val);
                        notifyChange(val.length > 0 ? val : null);
                        onSave(val.length > 0 ? val : null);
                    }}
                />
            )}

            {field.type === "file" && (
                <FileInput
                    value={localVal as string}
                    disabled={!canEdit}
                    onFileSelect={(file) => {
                        onFileSelect?.(field.id, file);
                    }}
                />
            )}

            {/* repeatable: keep existing CRM approach, no revamp equivalent */}
            {field.type === "repeatable" && (
                <input
                    type="text"
                    value={localVal as string}
                    disabled={!canEdit}
                    onChange={(e) => { setLocalVal(e.target.value); notifyChange(e.target.value || null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                    onFocus={() => setFocused(true)}
                    onBlur={(e) => { setFocused(false); commit(e.target.value); }}
                    placeholder={"Fill in…"}
                    style={inputStyle}
                />
            )}
        </AnalysisFieldRow>
    );
}

// ─── Form section ────────────────────────────────────────────────────────────

interface Props {
    fields: any[];
    categoryId?: number;
    values: Record<string, any>;
    canEdit: boolean;
    numberByKey?: Record<string, number>;
    onSave: (fieldId: number, value: any) => void;
    onChange?: (fieldId: number, value: any) => void;
    onFileSelect?: (fieldId: number, file: File) => void;
}

export default function AnalysisCustomFieldForm({
    fields,
    categoryId,
    values,
    canEdit,
    numberByKey,
    onSave,
    onChange,
    onFileSelect,
}: Props) {

    // No local mirror of `values`: the modal owns the merged value store and an
    // edit here is echoed straight back down through `values` in the same commit.
    // Mirroring it cost an extra state update (so a second render) and a second
    // visibility pass on every keystroke.
    const handleFieldChange = useCallback((fieldId: number, value: any) => {
        onChange?.(fieldId, value);
    }, [onChange]);

    const scopedFields = useMemo(() => {
        let scoped = categoryId != null
            ? fields.filter((f: any) => f.custom_field_category_id === categoryId)
            : fields;
        return scoped.filter((f: any) => f.type !== "file");
    }, [fields, categoryId]);

    const visibleFields = useMemo(() => {
        const visibilityMap = evaluateAllFieldsVisibility(scopedFields, values);
        return scopedFields.filter((f: any) => visibilityMap[f.id] !== false);
    }, [scopedFields, values]);

    if (visibleFields.length === 0) {
        return (
            <p style={{ fontSize: 13, color: A.TEXT_HINT, fontStyle: "italic", margin: 0 }}>
                {"No fields in this section."}
            </p>
        );
    }

    return (
        <div>
            {visibleFields.map((field: any) => (
                <FormField
                    key={field.id}
                    field={field}
                    value={values[`field_${field.id}`] ?? null}
                    fieldNumber={numberByKey?.[`deal_field_${field.id}`]}
                    canEdit={canEdit}
                    onChange={(value) => handleFieldChange(field.id, value)}
                    onSave={(value) => onSave(field.id, value)}
                    onFileSelect={onFileSelect}
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
