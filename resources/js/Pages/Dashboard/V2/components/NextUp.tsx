import { ReactNode } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";

export type Severity = "overdue" | "hot" | "stalled";

export interface QueueItem {
    key: string;
    /** English source string — translated at render. */
    label: string;
    /** Why it's here, already assembled by the caller. */
    reason: string;
    /** Opens the record — a modal where one exists, otherwise a page. */
    onOpen: () => void;
    /** English source string for the control that opens the record. */
    action: string;
    severity: Severity;
    /** Sort key — bigger is more urgent. Hours waiting, days overdue, … */
    weight: number;
}

const SEVERITY_DOT: Record<Severity, string> = {
    overdue: T.RED,
    hot: T.AMBER,
    stalled: T.TEXT_MUTED,
};

interface NextUpProps {
    items: QueueItem[];
    /** Per-row controls (Complete, Reschedule, Log activity). */
    renderActions?: (item: QueueItem) => ReactNode;
}

/**
 * The three things worth doing before opening anything else.
 *
 * Rows are a div, not a link: they carry buttons, and a button inside an anchor
 * is invalid HTML whose clicks the anchor swallows. The label is the link.
 *
 * There is still no Snooze. Snoozing is rescheduling with the reason hidden,
 * and nothing in this schema records "hidden until" — Reschedule says the same
 * thing honestly. Don't re-add it without somewhere to store it.
 */
export default function NextUp({ items, renderActions }: NextUpProps) {
    const { td } = useTd();

    if (!items.length) {
        return (
            <div style={{ padding: "18px 18px 22px" }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                    {td("Nothing is overdue")}
                </p>
                <p
                    style={{
                        margin: "4px 0 0",
                        fontSize: 14,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {td(
                        "No overdue tasks, uncontacted hot leads, or deals past their stage target.",
                    )}
                </p>
            </div>
        );
    }

    return (
        <div>
            {items.map((item) => (
                <div
                    key={item.key}
                    className="dv2-row"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 18px",
                        borderTop: `1px solid ${T.BORDER_SOFT}`,
                    }}
                >
                    <span
                        aria-hidden
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            flex: "none",
                            background: SEVERITY_DOT[item.severity],
                        }}
                    />

                    <button
                        type="button"
                        className="dv2-row-open"
                        onClick={item.onOpen}
                        style={{ flex: 1, minWidth: 0 }}
                    >
                        <span
                            style={{
                                display: "block",
                                fontSize: 15,
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {td(item.label)}
                        </span>
                        <span
                            style={{
                                display: "block",
                                fontSize: 13,
                                color: T.TEXT_MUTED,
                                marginTop: 3,
                            }}
                        >
                            {item.reason}
                        </span>
                    </button>

                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            flex: "none",
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                        }}
                    >
                        {renderActions?.(item)}
                        <button
                            type="button"
                            className="dr-btn dr-btn-primary"
                            onClick={item.onOpen}
                        >
                            {td(item.action)}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
