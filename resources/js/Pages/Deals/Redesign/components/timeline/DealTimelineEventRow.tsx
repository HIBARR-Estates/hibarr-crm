import dayjs from "dayjs";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import { Tooltip } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import {
    TimelineEventViewModel,
    getTimelineDirectionLabel,
    getTimelineDirectionTone,
    getTimelineStatusLabel,
    getTimelineStatusTone,
} from "../../adapters/timelineAdapter";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealIcon from "../primitives/DealIcon";

const DOT_COLORS = {
    agent: T.GREEN,
    system: T.GRAY_MID,
    external: T.AMBER,
} as const;

interface DealTimelineEventRowProps {
    event: TimelineEventViewModel;
    expanded: boolean;
    onToggleExpand: () => void;
    /** Admin-only management affordances for agent-logged events. */
    canManage?: boolean;
    onEdit?: (event: TimelineEventViewModel) => void;
    onDelete?: (event: TimelineEventViewModel) => void;
}

export default function DealTimelineEventRow({
    event,
    expanded,
    onToggleExpand,
    canManage = false,
    onEdit,
    onDelete,
}: DealTimelineEventRowProps) {
    const { td } = useTd();
    const { t } = useTranslation();

    const hasDetails = Boolean(event.details && event.details.length > 0);
    // Only events an agent logged by hand (custom event type) are editable or
    // deletable — system-recorded audit entries stay immutable.
    const showManage = canManage && event.isAgentLogged;
    // v2.2 folds the category into the changes summary ("Qualification · 3 fields")
    // rather than showing a separate category pill.
    const changeSummary = event.grouped
        ? td(event.grouped, { source: "en" })
        : event.changeCount
          ? `${event.categoryName ? `${td(event.categoryName, { source: "en" })} · ` : ""}${event.changeCount} ${
                event.changeCount === 1
                    ? t("pages.deals.timeline.field_changed_one")
                    : t("pages.deals.timeline.field_changed_many")
            }`
          : null;

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
                aria-hidden="true"
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
                        className="dr-pill dr-pill-gray"
                        style={{ textTransform: "capitalize" }}
                    >
                        {td(event.type, { source: "en" })}
                    </span>
                    {event.direction && (
                        <span
                            className={`dr-pill ${getTimelineDirectionTone(event.direction)}`}
                        >
                            {td(getTimelineDirectionLabel(event.direction), { source: "en" })}
                        </span>
                    )}
                    <span
                        className={`dr-pill ${getTimelineStatusTone(event.status)}`}
                    >
                        {td(getTimelineStatusLabel(event.status), { source: "en" })}
                    </span>

                    {showManage && (
                        <span
                            style={{
                                marginLeft: "auto",
                                display: "flex",
                                gap: 2,
                            }}
                        >
                            <button
                                type="button"
                                aria-label={t("pages.deals.timeline.edit_event")}
                                title={t("pages.deals.timeline.edit_event")}
                                onClick={() => onEdit?.(event)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 26,
                                    height: 26,
                                    borderRadius: 6,
                                    border: "none",
                                    background: "transparent",
                                    color: T.TEXT_MUTED,
                                    cursor: "pointer",
                                }}
                            >
                                <DealIcon name="edit" size={13} />
                            </button>
                            <button
                                type="button"
                                aria-label={t("pages.deals.timeline.delete_event")}
                                title={t("pages.deals.timeline.delete_event")}
                                onClick={() => onDelete?.(event)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 26,
                                    height: 26,
                                    borderRadius: 6,
                                    border: "none",
                                    background: "transparent",
                                    color: T.RED,
                                    cursor: "pointer",
                                }}
                            >
                                <DealIcon name="trash" size={13} />
                            </button>
                        </span>
                    )}
                </div>

                <Tooltip
                    title={formatCompanyDateTime(event.occurredAt)}
                >
                    <div style={{ fontSize: 12, color: T.TEXT_HINT }}>
                        {event.meta}
                    </div>
                </Tooltip>

                {changeSummary &&
                    (hasDetails ? (
                        <div>
                            <button
                                type="button"
                                aria-expanded={expanded}
                                onClick={onToggleExpand}
                                style={{
                                    marginTop: 6,
                                    width: "100%",
                                    background: T.SURFACE_2,
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 12,
                                    color: T.TEXT_MUTED,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    minHeight: 32,
                                }}
                            >
                                <span>{changeSummary}</span>
                                <span
                                    aria-hidden="true"
                                    style={{
                                        display: "flex",
                                        transition: "transform 0.15s",
                                        transform: expanded
                                            ? "rotate(180deg)"
                                            : "none",
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
                                        borderRadius: 8,
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
                                                padding: "8px 10px",
                                                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                                fontSize: 12,
                                                gap: 12,
                                            }}
                                        >
                                            <span style={{ color: T.TEXT_MUTED }}>
                                                {td(label, { source: "en" })}
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
                                                <span
                                                    style={{ color: T.TEXT_HINT }}
                                                    aria-hidden="true"
                                                >
                                                    →
                                                </span>
                                                <span
                                                    style={{
                                                        color: T.TEXT,
                                                        fontWeight: 600,
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
                    ) : (
                        <div
                            style={{
                                marginTop: 6,
                                fontSize: 12,
                                color: T.TEXT_MUTED,
                            }}
                        >
                            {changeSummary}
                        </div>
                    ))}

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
            </div>
        </div>
    );
}
