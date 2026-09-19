import { ReactNode } from "react";
import { Badge, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { QueueTask } from "../types";
import type { Severity } from "./types";
import { dueLabel, dueWhen, reasonOf, severityOf } from "./format";

/**
 * Severity is carried by glyph, uppercase word and rail weight together, never
 * by colour alone — the row still reads correctly in greyscale and to anyone
 * who can't separate the red from the amber.
 */
const SEVERITY: Record<
    Severity,
    { label: string; color: string; rail: string; railWidth: number; tint: string; paths: [string, string] }
> = {
    now: {
        label: "Now",
        color: T.RED,
        rail: T.RED,
        railWidth: 3,
        tint: "#fffdfd",
        paths: [
            "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
            "M12 9v4",
        ],
    },
    soon: {
        label: "Soon",
        color: T.AMBER,
        rail: T.AMBER,
        railWidth: 3,
        tint: T.SURFACE,
        paths: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
    },
    watch: {
        label: "Watch",
        color: T.TEXT_MUTED,
        rail: T.NAVY_MID,
        railWidth: 2,
        tint: T.SURFACE,
        paths: [
            "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z",
            "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
        ],
    },
};

interface SignalRowProps {
    task: QueueTask;
    /** Opens the task in TaskDetailModal. */
    onOpen: () => void;
    /** Opens the lead or deal the task hangs off, when it has one. */
    onOpenRecord?: () => void;
    /** Complete / Reschedule / Log activity, supplied by the page. */
    actions?: ReactNode;
}

/**
 * One task in the queue.
 *
 * The subject is the task title; the record it belongs to sits in the quieter
 * metadata line, deliberately below it — a deal never earns a row of its own
 * here, because "open a deal" is not an action anyone owes.
 *
 * The row is a div, not a link: it carries buttons, and a button inside an
 * anchor is invalid HTML whose clicks the anchor swallows. Only the subject
 * and the record name are clickable.
 */
export default function SignalRow({
    task,
    onOpen,
    onOpenRecord,
    actions,
}: SignalRowProps) {
    const { td } = useTd();
    const severity = severityOf(task);
    const config = SEVERITY[severity];
    const reason = reasonOf(task);

    return (
        <div
            className="dv2-signal"
            style={{
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                borderLeft: `${config.railWidth}px solid ${config.rail}`,
                background: config.tint,
            }}
        >
            <div
                style={{
                    display: "flex",
                    gap: 14,
                    padding: "15px 18px 15px 15px",
                    alignItems: "flex-start",
                }}
            >
                {severity !== "watch" && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            minWidth: 88,
                            paddingTop: 1,
                            flex: "none",
                        }}
                    >
                        <svg
                            width={16}
                            height={16}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={config.color}
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                            style={{ display: "block", flex: "none" }}
                        >
                            <path d={config.paths[0]} />
                            <path d={config.paths[1]} />
                        </svg>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                color: config.color,
                            }}
                        >
                            {td(config.label)}
                        </span>
                    </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 9,
                            flexWrap: "wrap",
                        }}
                    >
                        <button
                            type="button"
                            className="dv2-row-open"
                            onClick={onOpen}
                            style={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: T.NAVY,
                                lineHeight: 1.35,
                            }}
                        >
                            {task.heading}
                        </button>
                        <Badge variant="gray">{td(dueLabel(task))}</Badge>
                    </div>

                    {reason && (
                        <p
                            style={{
                                margin: "4px 0 0",
                                fontSize: 14,
                                lineHeight: 1.5,
                                color: T.TEXT,
                                maxWidth: 600,
                            }}
                        >
                            {reason}
                        </p>
                    )}

                    <div
                        style={{
                            marginTop: 6,
                            fontSize: 12,
                            lineHeight: 1.4,
                            color: T.TEXT_MUTED,
                        }}
                    >
                        <span
                            style={{
                                fontWeight: severity === "now" ? 600 : 400,
                                color:
                                    severity === "now" ? T.RED : T.TEXT_MUTED,
                            }}
                        >
                            {td(dueWhen(task))}
                        </span>
                        {task.related && (
                            <>
                                {" · "}
                                {onOpenRecord ? (
                                    <button
                                        type="button"
                                        className="dv2-row-open"
                                        onClick={onOpenRecord}
                                        style={{
                                            fontSize: 12,
                                            color: T.TEXT_MUTED,
                                        }}
                                    >
                                        {td(
                                            task.related.type === "lead"
                                                ? "Lead"
                                                : "Deal",
                                        )}
                                        : {task.related.name}
                                    </button>
                                ) : (
                                    <span>
                                        {td(
                                            task.related.type === "lead"
                                                ? "Lead"
                                                : "Deal",
                                        )}
                                        : {task.related.name}
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {actions && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flex: "none",
                            paddingTop: 2,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                        }}
                    >
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}
