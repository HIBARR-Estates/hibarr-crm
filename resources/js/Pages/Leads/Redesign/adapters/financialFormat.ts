import type {
    FinAssessment,
    FinCertainty,
    FinFrequency,
    FinKindOption,
    FinLine,
} from "../components/financials/types";

/**
 * Pure helpers for the Financials tab: money and date formatting, grouping of
 * lines by kind, the "copied / edited / new" marker of a draft line, and the
 * line-by-line comparison of two assessments. No hooks, no I/O.
 */

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
};

/** "2026-11-12" -> "12 Nov 2026". Date-only strings are read as local dates, not UTC. */
export function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return "—";
    return new Date(year, month - 1, day).toLocaleDateString(undefined, DATE_FORMAT);
}

export function formatDateTime(value: string | null | undefined): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
        ...DATE_FORMAT,
        hour: "2-digit",
        minute: "2-digit",
    });
}

/**
 * 42000 EUR -> "€42,000". A crypto ticker has no symbol, so it reads
 * "0.4 BTC" with up to eight decimals instead.
 */
export function formatMoney(
    amount: number,
    currency: string,
    cryptoCurrencies: readonly string[] = [],
): string {
    const code = currency.toUpperCase();
    const isCrypto = cryptoCurrencies.includes(code) || code.length !== 3;

    if (!isCrypto) {
        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: code,
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            }).format(amount);
        } catch {
            // Not a code Intl knows: fall through to the plain form.
        }
    }

    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(amount)} ${code}`;
}

/** "+€500" / "−€500"; null when nothing changed. */
export function formatDelta(
    now: number,
    before: number,
    currency: string,
): { text: string; direction: "up" | "down" } | null {
    const diff = Math.round((now - before) * 100) / 100;
    if (diff === 0) return null;
    const money = formatMoney(Math.abs(diff), currency);
    return diff > 0
        ? { text: `+${money}`, direction: "up" }
        : { text: `−${money}`, direction: "down" };
}

export const FREQUENCY_ORDER: FinFrequency[] = ["once", "monthly", "yearly"];
export const CERTAINTY_ORDER: FinCertainty[] = ["confirmed", "likely", "uncertain"];

export interface LineGroup {
    kindKey: string;
    kindLabel: string;
    role: FinLine["role"];
    lines: FinLine[];
}

/** Lines grouped by kind, in the admin's kind order; kinds that are inactive now still show their lines. */
export function groupLines(lines: FinLine[], kinds: FinKindOption[]): LineGroup[] {
    const order = new Map(kinds.map((kind, index) => [kind.key, index]));
    const groups = new Map<string, LineGroup>();

    for (const line of lines) {
        const existing = groups.get(line.kind_key);
        if (existing) {
            existing.lines.push(line);
        } else {
            groups.set(line.kind_key, {
                kindKey: line.kind_key,
                kindLabel: line.kind_label,
                role: line.role,
                lines: [line],
            });
        }
    }

    return [...groups.values()].sort(
        (a, b) => (order.get(a.kindKey) ?? 999) - (order.get(b.kindKey) ?? 999),
    );
}

/** Kinds to show in the collect drawer: every active kind (even empty) plus any retired kind that still has lines. */
export function groupsForEditing(lines: FinLine[], kinds: FinKindOption[]): LineGroup[] {
    const used = new Map(groupLines(lines, kinds).map((group) => [group.kindKey, group]));
    const result: LineGroup[] = kinds.map((kind) => ({
        kindKey: kind.key,
        kindLabel: kind.label,
        role: kind.role,
        lines: used.get(kind.key)?.lines ?? [],
    }));
    for (const group of used.values()) {
        if (!kinds.some((kind) => kind.key === group.kindKey)) result.push(group);
    }
    return result;
}

export type DraftLineState = "new" | "edited" | "carried";

/** How a draft line relates to the assessment it was copied from. */
export function draftLineState(line: FinLine): DraftLineState {
    if (!line.previous) return "new";
    const same =
        line.previous.amount === line.amount &&
        line.previous.currency === line.currency &&
        line.previous.frequency === line.frequency &&
        line.previous.certainty === line.certainty;
    return same ? "carried" : "edited";
}

export function draftChangeCounts(lines: FinLine[]): Record<DraftLineState, number> {
    const counts: Record<DraftLineState, number> = { new: 0, edited: 0, carried: 0 };
    for (const line of lines) counts[draftLineState(line)] += 1;
    return counts;
}

export type DiffStatus = "raised" | "lowered" | "changed" | "new" | "removed" | "unchanged";

export interface DiffRow {
    key: string;
    typeLabel: string;
    kindLabel: string;
    contributor: string | null;
    before: FinLine | null;
    after: FinLine | null;
    status: DiffStatus;
    /** Change in the converted amount (reporting currency), when both sides have one. */
    delta: number | null;
}

/**
 * Compare two assessments line by line. Lines are matched on type and
 * contributor (then by order, so two bank accounts pair up in sequence),
 * which works for any two assessments, not just neighbours.
 */
export function diffAssessments(newer: FinAssessment, older: FinAssessment): DiffRow[] {
    const keyed = (assessment: FinAssessment) => {
        const seen = new Map<string, number>();
        const map = new Map<string, FinLine>();
        for (const line of assessment.lines) {
            const base = `${line.type_key}|${line.contributor_label ?? ""}`;
            const n = (seen.get(base) ?? 0) + 1;
            seen.set(base, n);
            map.set(`${base}|${n}`, line);
        }
        return map;
    };

    const after = keyed(newer);
    const before = keyed(older);
    const keys = [...new Set([...after.keys(), ...before.keys()])];

    return keys.map((key) => {
        const a = after.get(key) ?? null;
        const b = before.get(key) ?? null;
        const reference = a ?? b;
        let status: DiffStatus = "unchanged";
        let delta: number | null = null;

        if (a && !b) status = "new";
        else if (!a && b) status = "removed";
        else if (a && b) {
            delta =
                a.converted_amount !== null && b.converted_amount !== null
                    ? Math.round((a.converted_amount - b.converted_amount) * 100) / 100
                    : null;
            if (delta !== null && delta !== 0) status = delta > 0 ? "raised" : "lowered";
            else if (
                delta === null &&
                (a.amount !== b.amount || a.currency !== b.currency)
            )
                status = a.amount > b.amount ? "raised" : "lowered";
            else if (a.frequency !== b.frequency || a.certainty !== b.certainty) status = "changed";
        }

        return {
            key,
            typeLabel: reference?.type_label ?? "",
            kindLabel: reference?.kind_label ?? "",
            contributor: reference?.contributor_label ?? null,
            before: b,
            after: a,
            status,
            delta,
        };
    });
}
