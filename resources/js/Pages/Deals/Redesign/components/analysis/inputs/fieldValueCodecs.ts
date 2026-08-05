/**
 * Convert-at-the-boundary helpers for analysis modal inputs.
 * CRM storage format ↔ component internal pipe format.
 * Never invent a new storage format — these must match CustomFieldDisplay / EditableField / RangeInput.
 */

export interface FieldOption { value: string; label: string; }

export function parseOptions(rawValues: any): FieldOption[] {
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

// ── Currency ({amount, currency} ↔ "CODE|amount") ───────────────────────────

export function crmToPipeCurrency(rawValue: any, defaultCurrency = "GBP"): string {
    const fallback = `${defaultCurrency}|`;
    if (rawValue === null || rawValue === undefined) return fallback;
    if (typeof rawValue === "number") return `${defaultCurrency}|${rawValue}`;
    let obj: any = rawValue;
    if (typeof rawValue === "string") {
        const n = Number(rawValue);
        if (!isNaN(n) && rawValue.trim() !== "") return `${defaultCurrency}|${n}`;
        try { obj = JSON.parse(rawValue); } catch { return fallback; }
    }
    if (obj && typeof obj === "object") {
        const amt = obj.amount !== undefined && obj.amount !== null && obj.amount !== ""
            ? Number(obj.amount) : "";
        return `${obj.currency || defaultCurrency}|${isNaN(amt as number) ? "" : amt}`;
    }
    return fallback;
}

export function pipeToAmountObj(val: string): { amount: number | null; currency: string } {
    const [code = "GBP", rawAmt = ""] = val.split("|");
    const digits = rawAmt.replace(/[^0-9.]/g, "");
    return { amount: digits ? Number(digits) : null, currency: code };
}

// ── Currency Range ({min, max, currency} ↔ "CODE|min|max") ─────────────────

export function crmToPipeCurrencyRange(rawValue: any, defaultCurrency = "GBP"): string {
    if (!rawValue) return `${defaultCurrency}||`;
    let obj: any = rawValue;
    if (typeof rawValue === "string") {
        try { obj = JSON.parse(rawValue); } catch { return `${defaultCurrency}||`; }
    }
    if (obj && typeof obj === "object") {
        return `${obj.currency || defaultCurrency}|${obj.min ?? ""}|${obj.max ?? ""}`;
    }
    return `${defaultCurrency}||`;
}

export function pipeToCurrencyRangeObj(val: string): { min: number | null; max: number | null; currency: string } {
    const [code = "GBP", rawMin = "", rawMax = ""] = val.split("|");
    const parseNum = (s: string) => {
        const d = s.replace(/[^0-9.]/g, "");
        return d ? Number(d) : null;
    };
    return { currency: code, min: parseNum(rawMin), max: parseNum(rawMax) };
}

// ── Range ({min, max} ↔ "min,max") ──────────────────────────────────────────

export function crmToPipeRange(rawValue: any): string {
    if (!rawValue) return ",";
    let obj: any = rawValue;
    if (typeof rawValue === "string") {
        try { obj = JSON.parse(rawValue); } catch { return ","; }
    }
    if (obj && typeof obj === "object") {
        return `${obj.min ?? ""},${obj.max ?? ""}`;
    }
    return ",";
}

export function pipeToRangeObj(val: string): { min: number | null; max: number | null } {
    const [rawMin = "", rawMax = ""] = val.split(",");
    const parseNum = (s: string) => {
        const d = s.replace(/[^0-9.]/g, "");
        return d ? Number(d) : null;
    };
    return { min: parseNum(rawMin), max: parseNum(rawMax) };
}

// ── Multivalue (checkbox/multiselect/multiSelectCountry ↔ string[]) ─────────

export function crmToMultiArray(rawValue: any): string[] {
    if (Array.isArray(rawValue)) return rawValue.map(String);
    if (typeof rawValue === "string") {
        try { return JSON.parse(rawValue); }
        catch { return rawValue.split(",").map((v: string) => v.trim()).filter(Boolean); }
    }
    return [];
}

// ── Date (ISO string or Date object ↔ "YYYY-MM-DD") ─────────────────────────

export function crmToDateString(rawValue: any): string {
    if (!rawValue) return "";
    try {
        const d = new Date(rawValue);
        if (isNaN(d.getTime())) return "";
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    } catch { return ""; }
}

// ── Phone (plain string ↔ "dial|number") ────────────────────────────────────
// CRM stores a plain string. PhoneInput works with "dial|number" internally.
// Convert at the boundary; persist plain number (no pipe) back to storage.

export function pipePhoneToPlain(val: string): string {
    if (!val.includes("|")) return val;
    const [dial = "", number = ""] = val.split("|");
    return `${dial}${number}`.trim();
}

export function plainPhoneToPipe(val: string, defaultDial = "+44"): string {
    if (val.includes("|")) return val;
    return `${defaultDial}|${val}`;
}

// ── Generic toInputValue ─────────────────────────────────────────────────────

export function toInputValue(type: string, rawValue: any): string | string[] {
    switch (type) {
        case "currency": return crmToPipeCurrency(rawValue);
        case "currency_range": return crmToPipeCurrencyRange(rawValue);
        case "range": return crmToPipeRange(rawValue);
        case "checkbox":
        case "multiselect":
        case "multiSelectCountry": return crmToMultiArray(rawValue);
        case "date": return crmToDateString(rawValue);
        case "phone": return plainPhoneToPipe(String(rawValue || ""));
        default:
            if (rawValue === null || rawValue === undefined) return "";
            return String(rawValue);
    }
}

export function toSaveValue(type: string, inputVal: string | string[]): any {
    switch (type) {
        case "currency": return pipeToAmountObj(inputVal as string);
        case "currency_range": return pipeToCurrencyRangeObj(inputVal as string);
        case "range": return pipeToRangeObj(inputVal as string);
        case "phone": return pipePhoneToPlain(inputVal as string);
        case "checkbox":
        case "multiselect":
        case "multiSelectCountry": {
            const arr = inputVal as string[];
            return arr.length > 0 ? arr : null;
        }
        default: {
            const v = inputVal as string;
            return v.trim() === "" ? null : v;
        }
    }
}
