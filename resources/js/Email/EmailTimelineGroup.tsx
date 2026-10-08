import { useState } from "react";
import { Badge, Icon } from "@/Components/Redesign";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import type {
    EmailTimelineGroup as EmailTimelineGroupData,
    EmailTimelineMessage,
    EmailTimelineSendStatus,
} from "@/Email/types";

interface EmailTimelineGroupProps {
    group: EmailTimelineGroupData;
    onOpenMessage: (messageId: string) => void;
}

function statusBadge(
    status: EmailTimelineSendStatus | null,
    t: (key: string) => string,
): { label: string; variant: "red" | "amber" | "gray" | "green" } | null {
    if (!status) return null;
    switch (status) {
        case "failed":
            return {
                label: t("pages.email.timeline.status_failed"),
                variant: "red",
            };
        case "checking":
            return {
                label: t("pages.email.timeline.status_checking"),
                variant: "amber",
            };
        case "waiting_quota":
            return {
                label: t("pages.email.timeline.status_waiting"),
                variant: "amber",
            };
        case "sending":
            return {
                label: t("pages.email.timeline.status_sending"),
                variant: "gray",
            };
        case "sent":
            return {
                label: t("pages.email.timeline.status_sent"),
                variant: "green",
            };
        default:
            return null;
    }
}

function directionLabel(
    direction: string | null,
    t: (key: string) => string,
): string | null {
    if (direction === "inbound") {
        return t("pages.email.timeline.direction_inbound");
    }
    if (direction === "outbound") {
        return t("pages.email.timeline.direction_outbound");
    }
    return null;
}

function MessageRow({
    message,
    onOpen,
}: {
    message: EmailTimelineMessage;
    onOpen: () => void;
}) {
    const { t } = useTranslation();
    const { formatDateTime } = useUserDateTime();
    const badge = statusBadge(message.send_status, t);
    const direction = directionLabel(message.direction, t);
    const when = message.sent_at ? formatDateTime(message.sent_at) : "";

    return (
        <button
            type="button"
            onClick={onOpen}
            style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: T.SURFACE_2,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 8,
                padding: "8px 10px",
                cursor: "pointer",
                marginTop: 6,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    flexWrap: "wrap",
                    marginBottom: 2,
                }}
            >
                <span style={{ fontSize: 12, fontWeight: 500, color: T.TEXT }}>
                    {message.subject?.trim() ||
                        t("pages.email.timeline.no_subject")}
                </span>
                {direction && (
                    <Badge variant="gray" style={{ fontSize: 11, padding: "2px 8px" }}>
                        {direction}
                    </Badge>
                )}
                {badge && (
                    <Badge
                        variant={badge.variant}
                        style={{ fontSize: 11, padding: "2px 8px" }}
                    >
                        {badge.label}
                    </Badge>
                )}
                {message.unread && (
                    <Badge variant="blue" style={{ fontSize: 11, padding: "2px 8px" }}>
                        {t("pages.email.timeline.unread")}
                    </Badge>
                )}
            </div>
            {when && (
                <div style={{ fontSize: 11, color: T.TEXT_HINT }}>{when}</div>
            )}
            {message.preview && (
                <div
                    style={{
                        fontSize: 12,
                        color: T.TEXT_MUTED,
                        marginTop: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {message.preview}
                </div>
            )}
        </button>
    );
}

/**
 * Compact Timeline row for one email conversation. Expand shows dated
 * messages; click opens that message in the record drawer.
 */
export default function EmailTimelineGroup({
    group,
    onOpenMessage,
}: EmailTimelineGroupProps) {
    const { t } = useTranslation();
    const { formatDateTime } = useUserDateTime();
    const [expanded, setExpanded] = useState(false);

    const badge = statusBadge(group.status, t);
    const direction = directionLabel(group.latest_direction, t);
    const when = group.latest_sent_at
        ? formatDateTime(group.latest_sent_at)
        : "";
    const subject =
        group.subject?.trim() || t("pages.email.timeline.no_subject");
    const countLabel = t("pages.email.timeline.message_count").replace(
        "{{count}}",
        String(group.message_count),
    );
    const canExpand = group.message_count > 1;

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
                        background: badge?.variant === "red" ? T.RED : T.BLUE,
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
                    <button
                        type="button"
                        onClick={() =>
                            onOpenMessage(group.latest_message_id)
                        }
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 500,
                            color: T.TEXT,
                            textAlign: "left",
                        }}
                    >
                        <Icon name="mail" size={14} />
                        <span>{subject}</span>
                    </button>
                    <Badge variant="blue">{t("pages.email.timeline.email")}</Badge>
                    {direction && <Badge variant="gray">{direction}</Badge>}
                    {badge && (
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                    )}
                    {group.unread_count > 0 && (
                        <Badge variant="teal">
                            {t("pages.email.timeline.unread_count").replace(
                                "{{count}}",
                                String(group.unread_count),
                            )}
                        </Badge>
                    )}
                </div>

                <div style={{ fontSize: 12, color: T.TEXT_HINT }}>
                    {when
                        ? `${countLabel} · ${when}`
                        : countLabel}
                </div>

                {group.preview && !expanded && (
                    <div
                        style={{
                            fontSize: 12,
                            color: T.TEXT_MUTED,
                            marginTop: 6,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {group.preview}
                    </div>
                )}

                {canExpand && (
                    <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpanded((value) => !value)}
                        style={{
                            marginTop: 8,
                            background: "none",
                            border: "none",
                            padding: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 12,
                            color: T.TEXT_MUTED,
                            cursor: "pointer",
                        }}
                    >
                        <Icon
                            name={expanded ? "chevron-up" : "chevron-down"}
                            size={12}
                        />
                        {expanded
                            ? t("pages.email.timeline.collapse")
                            : t("pages.email.timeline.expand")}
                    </button>
                )}

                {expanded &&
                    group.messages.map((message) => (
                        <MessageRow
                            key={message.id}
                            message={message}
                            onOpen={() => onOpenMessage(message.id)}
                        />
                    ))}
            </div>
        </div>
    );
}
