import { type ReactNode } from "react";
import dayjs from "dayjs";
import { Tooltip } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    TimelineEventViewModel,
    getTimelineDirectionLabel,
    getTimelineStatusLabel,
} from "../../adapters/timelineAdapter";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

const DOT_COLORS = {
    agent: T.GREEN,
    system: T.GRAY_MID,
    external: T.AMBER,
} as const;

interface DealTimelineEventRowProps {
    event: TimelineEventViewModel;
    expanded: boolean;
    onToggleExpand: () => void;
}

function MetaPill({ children }: { children: ReactNode }) {
    return (
        <span
            style={{
                fontSize: 11,
                padding: "2px 7px",
                borderRadius: 10,
                background: T.GRAY,
                color: T.TEXT_MUTED,
                border: `1px solid ${T.BORDER}`,
            }}
        >
            {children}
        </span>
    );
}

export default function DealTimelineEventRow({
    event,
    expanded,
    onToggleExpand,
}: DealTimelineEventRowProps) {
    const { td } = useTd();

    return (
        <div
            style={{
                display: "flex",
                gap: 12,
                paddingBottom: 16,
                marginBottom: 16,
                borderBottom: `1px solid ${T.BORDER}`,
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: 4,
                }}
            >
                <div
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: DOT_COLORS[event.dot],
                        flexShrink: 0,
                    }}
                />
                <div
                    style={{
                        width: 1,
                        flex: 1,
                        background: T.BORDER,
                        marginTop: 4,
                    }}
                />
            </div>

            <div style={{ flex: 1, paddingBottom: 4, minWidth: 0 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 3,
                        flexWrap: "wrap",
                    }}
                >
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {td(event.title)}
                    </span>
                    <span
                        style={{
                            fontSize: 11,
                            padding: "2px 7px",
                            borderRadius: 10,
                            background: T.GRAY,
                            color: T.TEXT_MUTED,
                            border: `1px solid ${T.BORDER}`,
                            textTransform: "capitalize",
                        }}
                    >
                        {event.type}
                    </span>
                </div>

                <Tooltip
                    title={dayjs(event.occurredAt).format("MMM D, YYYY · h:mm A")}
                >
                    <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                        {event.meta}
                    </div>
                </Tooltip>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 6,
                    }}
                >
                    {event.categoryName && (
                        <MetaPill>{td(event.categoryName)}</MetaPill>
                    )}
                    <MetaPill>{td(getTimelineStatusLabel(event.status))}</MetaPill>
                    {event.direction && (
                        <MetaPill>
                            {td(getTimelineDirectionLabel(event.direction))}
                        </MetaPill>
                    )}
                    {event.source && <MetaPill>{td(event.source)}</MetaPill>}
                </div>

                {event.grouped && (
                    <div>
                        <button
                            type="button"
                            onClick={onToggleExpand}
                            style={{
                                marginTop: 6,
                                width: "100%",
                                background: T.GRAY,
                                borderRadius: 6,
                                padding: "6px 10px",
                                fontSize: 12,
                                color: T.TEXT_MUTED,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                cursor: "pointer",
                                border: "none",
                                textAlign: "left",
                            }}
                        >
                            <span>{event.grouped}</span>
                            <span
                                style={{
                                    display: "flex",
                                    transition: "transform 0.15s",
                                    transform: expanded ? "rotate(180deg)" : "none",
                                }}
                            >
                                ▾
                            </span>
                        </button>

                        {expanded && event.details && (
                            <div
                                style={{
                                    marginTop: 6,
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: 6,
                                    overflow: "hidden",
                                }}
                            >
                                {event.details.map(([label, from, to]) => (
                                    <div
                                        key={`${event.id}-${label}`}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "7px 10px",
                                            borderBottom: `1px solid ${T.BORDER}`,
                                            fontSize: 12,
                                            gap: 12,
                                        }}
                                    >
                                        <span style={{ color: T.TEXT_MUTED }}>
                                            {label}
                                        </span>
                                        <span
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 6,
                                                minWidth: 0,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    color: T.TEXT_HINT,
                                                    fontStyle: "italic",
                                                }}
                                            >
                                                {from}
                                            </span>
                                            <span style={{ color: T.TEXT_HINT }}>
                                                →
                                            </span>
                                            <span
                                                style={{
                                                    color: T.TEXT,
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {to}
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {event.preview && (
                    <div
                        style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: T.TEXT_MUTED,
                            lineHeight: 1.5,
                            fontStyle: "italic",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {event.preview}
                    </div>
                )}

                {event.correlationId && (
                    <Tooltip title={`ID: ${event.correlationId}`}>
                        <div
                            style={{
                                marginTop: 8,
                                fontSize: 10,
                                fontFamily: "monospace",
                                color: T.TEXT_HINT,
                            }}
                        >
                            ↳ {event.correlationId.slice(0, 8)}
                        </div>
                    </Tooltip>
                )}
            </div>
        </div>
    );
}
