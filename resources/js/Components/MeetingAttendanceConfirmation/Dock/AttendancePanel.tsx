import axios from "axios";
import { useEffect, useRef, type CSSProperties } from "react";
import dayjs from "dayjs";
import { getInitials, monogramColor } from "@/Components/UserIndicator";
import { useOptionalNotificationAlert } from "@/Components/NotificationAlertProvider";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import type { PendingMeetingAttendanceConfirmation } from "@/Types/api/meeting-attendance-confirmation";
import { MEETING_TYPE_TONE } from "../tone";

interface AttendancePanelProps {
    items: PendingMeetingAttendanceConfirmation[];
    page: number;
    onPageChange: (page: number) => void;
    onMinimize: () => void;
    onOpen: (id: number) => void;
    onSnoozed: (item: PendingMeetingAttendanceConfirmation) => void;
    /** Re-adds a snoozed item to the list — wired to the notification's Undo action. */
    onRestore: (item: PendingMeetingAttendanceConfirmation) => void;
}

/** The expanded reminders dock: one pending confirmation at a time, with Prev/Next paging. */
export default function AttendancePanel({
    items,
    page,
    onPageChange,
    onMinimize,
    onOpen,
    onSnoozed,
    onRestore,
}: AttendancePanelProps) {
    const { td } = useTd();
    const alert = useOptionalNotificationAlert();
    const panelRef = useRef<HTMLElement>(null);
    const active = items.length;
    const effPage = Math.min(page, Math.max(0, active - 1));
    const current = items[effPage];

    // Clicking anywhere outside the panel tucks it away, same as the minimize button.
    useEffect(() => {
        const onPointerDown = (event: MouseEvent) => {
            if (
                !panelRef.current ||
                panelRef.current.contains(event.target as Node)
            )
                return;
            onMinimize();
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [onMinimize]);

    const snoozeMutation = useApiMutate<
        { minutes?: number },
        { id: number },
        ApiResponse<{ id: number }>
    >(
        route("meetings.api.attendance_confirmation.snooze", {
            followUp: current?.id ?? 0,
        }),
        "POST",
    );

    const handleSnooze = () => {
        if (!current) return;
        const item = current;

        // Optimistic: hide it and fire the request in the background instead of
        // waiting on the response — a failure here just means the next 60s poll
        // re-adds it, which is an acceptable self-heal for how low-stakes this is.
        onSnoozed(item);
        snoozeMutation.mutate({});

        alert?.push({
            id: `attendance-snooze-${item.id}-${Date.now()}`,
            title: td("Snoozed", { source: "en" }),
            meta: td(
                `${item.contact_name || "This meeting"} · back in 1 hour`,
                { source: "en" },
            ),
            severity: "gray",
            actions: [
                {
                    label: td("Undo", { source: "en" }),
                    onClick: () => {
                        onRestore(item);
                        axios
                            .post(
                                route(
                                    "meetings.api.attendance_confirmation.snooze",
                                    {
                                        followUp: item.id,
                                    },
                                ),
                                { minutes: 0 },
                            )
                            .catch(() => {});
                    },
                },
            ],
        });
    };

    const contactName =
        current?.contact_name || td("this contact", { source: "en" });
    const scheduled = current?.scheduled_at
        ? dayjs(current.scheduled_at)
        : null;

    return (
        <aside
            ref={panelRef}
            className="hb-attendance-panel-enter"
            style={{
                position: "fixed",
                right: 14,
                top: "50%",
                translate: "0 -50%",
                width: 298,
                maxHeight: "calc(100vh - 40px)",
                zIndex: 40,
                display: "flex",
                flexDirection: "column",
                background: "#ffffff",
                border: "1px solid #e2e5ea",
                borderRadius: 14,
                boxShadow: "0 14px 36px rgba(22,41,77,0.16)",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    background: "#003160",
                    color: "#ffffff",
                }}
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 700,
                            lineHeight: 1.2,
                        }}
                    >
                        {td("Meeting check-ins", { source: "en" })}
                    </div>
                    <div
                        style={{ fontSize: 11, color: "#aeb9cc", marginTop: 1 }}
                    >
                        {active > 0
                            ? td(
                                  `${active} meeting${active > 1 ? "s" : ""} need an update`,
                                  { source: "en" },
                              )
                            : td("You are all caught up", { source: "en" })}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onMinimize}
                    title={td("Tuck away", { source: "en" })}
                    style={{
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        color: "#ffffff",
                        cursor: "pointer",
                        borderRadius: 7,
                        padding: 6,
                        display: "flex",
                    }}
                >
                    <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.7}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M13 5l7 7-7 7" />
                        <path d="M5 12h15" />
                    </svg>
                </button>
            </div>

            {current ? (
                <>
                    <div
                        style={{
                            padding: "12px 12px 6px",
                            background: "#f8f9fb",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => onOpen(current.id)}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 11,
                                width: "100%",
                                textAlign: "left",
                                cursor: "pointer",
                                background: "#ffffff",
                                border: "1px solid #e2e5ea",
                                borderRadius: 12,
                                padding: "13px 13px 14px",
                            }}
                        >
                            <span
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 11,
                                    width: "100%",
                                }}
                            >
                                <span
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 10,
                                        flexShrink: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontWeight: 700,
                                        fontSize: 13,
                                        color: "#ffffff",
                                        background: monogramColor(contactName),
                                    }}
                                >
                                    {getInitials(contactName)}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: "#16294d",
                                            lineHeight: 1.3,
                                        }}
                                    >
                                        {td(`Did ${contactName} attend?`)}
                                    </span>
                                    <span
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 7,
                                            marginTop: 5,
                                        }}
                                    >
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                fontSize: 11,
                                                fontWeight: 600,
                                                lineHeight: 1.2,
                                                padding: "2px 8px",
                                                borderRadius: 999,
                                                background:
                                                    MEETING_TYPE_TONE.bg,
                                                color: MEETING_TYPE_TONE.c,
                                                border: `1px solid ${MEETING_TYPE_TONE.bd}`,
                                            }}
                                        >
                                            {current.meeting_type_label?.trim() ||
                                                td("Meeting", { source: "en" })}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                color: "#5b6472",
                                            }}
                                        >
                                            {scheduled
                                                ? scheduled.format("ddd D MMM")
                                                : ""}
                                        </span>
                                    </span>
                                </span>
                            </span>
                        </button>

                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            <button
                                type="button"
                                onClick={handleSnooze}
                                style={{
                                    flex: 1,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    padding: 8,
                                    borderRadius: 9,
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: "#ffffff",
                                    color: "#5b6472",
                                    border: "1px solid #e2e5ea",
                                }}
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={1.8}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M12 7v5l3 2" />
                                </svg>
                                {td("Snooze", { source: "en" })}
                            </button>
                            <button
                                type="button"
                                onClick={() => onOpen(current.id)}
                                style={{
                                    flex: 1,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    padding: 8,
                                    borderRadius: 9,
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: "#003160",
                                    color: "#ffffff",
                                    border: "1px solid #003160",
                                }}
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="7" y1="17" x2="17" y2="7" />
                                    <polyline points="7 7 17 7 17 17" />
                                </svg>
                                {td("Open", { source: "en" })}
                            </button>
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 6,
                            padding: "8px 12px 12px",
                            background: "#f8f9fb",
                        }}
                    >
                        <span
                            style={{
                                flex: 1,
                                fontSize: 11,
                                color: "#5b6472",
                                fontWeight: 600,
                            }}
                        >
                            {td(`${effPage + 1} of ${active}`, {
                                source: "en",
                            })}
                        </span>
                        <button
                            type="button"
                            disabled={effPage <= 0}
                            onClick={() =>
                                onPageChange(Math.max(0, effPage - 1))
                            }
                            style={navButtonStyle(effPage <= 0)}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.9}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            disabled={effPage >= active - 1}
                            onClick={() =>
                                onPageChange(Math.min(active - 1, effPage + 1))
                            }
                            style={navButtonStyle(effPage >= active - 1)}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.9}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </button>
                    </div>
                </>
            ) : (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        padding: "34px 20px",
                        color: "#5b6472",
                        background: "#f8f9fb",
                    }}
                >
                    <span
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 999,
                            background: "#e1f5ee",
                            color: "#177a5b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 12,
                        }}
                    >
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M20 6 9 17l-5-5" />
                        </svg>
                    </span>
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#16294d",
                        }}
                    >
                        {td("All caught up", { source: "en" })}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                        {td("Every meeting has an attendance update.", {
                            source: "en",
                        })}
                    </div>
                </div>
            )}
        </aside>
    );
}

function navButtonStyle(disabled: boolean): CSSProperties {
    return {
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 9,
        cursor: disabled ? "not-allowed" : "pointer",
        background: "#ffffff",
        color: "#16294d",
        border: "1px solid #e2e5ea",
        opacity: disabled ? 0.4 : 1,
    };
}
