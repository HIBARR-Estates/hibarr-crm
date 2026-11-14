import { useCallback, useEffect, useState } from "react";
import type { CommissionLine, DisputeView } from "./types";

export interface OpenDispute {
    id: number;
    mode: "send" | "view";
}

/**
 * The commission lines a screen shows, kept as local state so a dispute sent
 * from the bar marks its line at once, with no reload. Also holds which line's
 * dispute bar is open.
 */
export default function useCommissionLines(items: CommissionLine[]) {
    const [lines, setLines] = useState(items);
    const [open, setOpen] = useState<OpenDispute | null>(null);

    useEffect(() => setLines(items), [items]);

    const markDisputed = useCallback((commissionId: number, dispute: DisputeView) => {
        setLines((current) => current.map((line) => (line.id === commissionId ? { ...line, disputed: true, can_dispute: false, dispute } : line)));
        // The bar closes only if it is still this line's: another line opened while the request ran keeps its draft.
        setOpen((now) => (now?.id === commissionId ? null : now));
    }, []);

    const current = open ? (lines.find((line) => line.id === open.id) ?? null) : null;

    return {
        lines,
        open: current && open ? { line: current, mode: open.mode } : null,
        openDispute: useCallback((line: CommissionLine) => setOpen({ id: line.id, mode: "send" }), []),
        viewDispute: useCallback((line: CommissionLine) => setOpen({ id: line.id, mode: "view" }), []),
        closeDispute: useCallback(() => setOpen(null), []),
        markDisputed,
    };
}
