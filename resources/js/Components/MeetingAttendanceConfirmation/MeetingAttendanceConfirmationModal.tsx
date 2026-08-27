import { useMemo, useState, type CSSProperties } from "react";
import dayjs from "dayjs";
import TaskModalShell from "@/Pages/Tasks/Redesign/components/primitives/TaskModalShell";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { formatCompanyTime } from "@/lib/companyDateTime";
import type {
    MeetingAttendanceOutcome,
    PendingMeetingAttendanceConfirmation,
} from "@/Types/api/meeting-attendance-confirmation";
import { TONE } from "./tone";

interface OutcomeDef {
    key: MeetingAttendanceOutcome;
    label: string;
    helper: string;
    tone: { c: string; bg: string; bd: string };
    icon: React.ReactNode;
}

interface MeetingAttendanceConfirmationModalProps {
    meeting: PendingMeetingAttendanceConfirmation;
    onDismiss: () => void;
    onConfirmed: () => void;
}

export default function MeetingAttendanceConfirmationModal({
    meeting,
    onDismiss,
    onConfirmed,
}: MeetingAttendanceConfirmationModalProps) {
    const { td } = useTd();
    const [selected, setSelected] = useState<MeetingAttendanceOutcome | null>(
        null,
    );
    const [note, setNote] = useState("");
    const [noteFocused, setNoteFocused] = useState(false);

    const outcomes: OutcomeDef[] = useMemo(
        () => [
            {
                key: "attended",
                label: td("Attended", { source: "en" }),
                helper: td("Showed up as planned", { source: "en" }),
                tone: TONE.green,
                icon: <path d="M20 6 9 17l-5-5" />,
            },
            {
                key: "no_show",
                label: td("Did not attend (no-show)", { source: "en" }),
                helper: td("Missed it without notice", { source: "en" }),
                tone: TONE.red,
                icon: (
                    <>
                        <path d="M18 6 6 18" />
                        <path d="M6 6l12 12" />
                    </>
                ),
            },
            {
                key: "rescheduled",
                label: td("Rescheduled / postponed", { source: "en" }),
                helper: td("Moved to a new date or time", { source: "en" }),
                tone: TONE.amber,
                icon: (
                    <>
                        <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
                        <path d="M3 21v-5h5" />
                    </>
                ),
            },
            {
                key: "cancelled",
                label: td("Cancelled", { source: "en" }),
                helper: td("Meeting will not take place", { source: "en" }),
                tone: TONE.gray,
                icon: (
                    <>
                        <path d="M8 2v4" />
                        <path d="M16 2v4" />
                        <path d="M3 10h18" />
                        <path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                        <path d="m9 15 6-6" />
                        <path d="m9 9 6 6" />
                    </>
                ),
            },
            {
                key: "partial",
                label: td("Partially attended", { source: "en" }),
                helper: td("Left early", { source: "en" }),
                tone: TONE.teal,
                icon: (
                    <>
                        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
                        <path d="M12 7v5l3 2" />
                    </>
                ),
            },
        ],
        [td],
    );

    const confirmLabels: Record<MeetingAttendanceOutcome, string> = {
        attended: td("Mark as attended", { source: "en" }),
        no_show: td("Mark as no-show", { source: "en" }),
        rescheduled: td("Mark as rescheduled", { source: "en" }),
        cancelled: td("Mark as cancelled", { source: "en" }),
        partial: td("Mark as partial", { source: "en" }),
    };

    const confirmMutation = useApiMutate<
        { outcome: MeetingAttendanceOutcome; note: string | null },
        { id: number },
        ApiResponse<{ id: number }>
    >(
        route("meetings.api.attendance_confirmation.confirm", {
            followUp: meeting.id,
        }),
        "POST",
        () => onConfirmed(),
    );

    const selectedOutcome = outcomes.find((o) => o.key === selected) ?? null;
    const contactName =
        meeting.contact_name || td("this contact", { source: "en" });
    const meetingTypeLabel = meeting.meeting_type_label?.trim();
    // Meeting type names often already end in "Meeting" (e.g. "Strategy
    // Meeting") — only append the word when it isn't already there, so this
    // doesn't read as "Strategy Meeting meeting".
    const meetingLabel = meetingTypeLabel
        ? /meeting$/i.test(meetingTypeLabel)
            ? meetingTypeLabel
            : `${meetingTypeLabel} meeting`
        : "meeting";
    const title = td(`Did ${contactName} attend the ${meetingLabel}?`);

    const scheduled = meeting.scheduled_at ? dayjs(meeting.scheduled_at) : null;
    // Short and direct — who/when is already shown above, this just needs to
    // prompt for the outcome detail.
    const noteLabel = td("How did the meeting go?", { source: "en" });

    const handleConfirm = () => {
        if (!selectedOutcome || confirmMutation.isPending) return;
        confirmMutation.mutate({
            outcome: selectedOutcome.key,
            note: note.trim() !== "" ? note.trim() : null,
        });
    };

    const rowStyle = (active: boolean): CSSProperties => ({
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "11px 13px",
        borderRadius: 10,
        cursor: "pointer",
        fontFamily: "var(--font-sans, inherit)",
        textAlign: "left",
        background: active ? "#e8f1fb" : "#ffffff",
        border: `1px solid ${active ? "#b8d4f0" : "#e2e5ea"}`,
        boxShadow: active ? "0 0 0 2px #e8f1fb" : "none",
        transition:
            "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
    });

    return (
        <TaskModalShell
            open
            onClose={onDismiss}
            closeOnBackdrop
            ariaLabel={title}
            zIndex={1000}
            panelStyle={{
                width: "100%",
                maxWidth: 480,
                background: "#ffffff",
                borderRadius: 14,
                boxShadow: "0 20px 50px rgba(22,41,77,0.18)",
                overflow: "hidden",
                // TaskModalShell programmatically focuses this panel on open;
                // without this the browser's default focus ring renders around it.
                outline: "none",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "16px 22px 14px",
                    background: "#f8f9fb",
                    borderBottom: "1px solid #eef0f3",
                }}
            >
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            letterSpacing: "0.03em",
                            textTransform: "uppercase",
                            color: "#14538c",
                        }}
                    >
                        {td("Follow-up reminder", { source: "en" })}
                    </div>
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "#16294d",
                            lineHeight: 1.3,
                            marginTop: 5,
                        }}
                    >
                        {title}
                    </div>
                    <div
                        style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}
                    >
                        {td("Logged to this lead's timeline", { source: "en" })}
                    </div>
                </div>
                <button
                    type="button"
                    aria-label={td("Close", { source: "en" })}
                    onClick={onDismiss}
                    style={{
                        background: "none",
                        border: "none",
                        padding: 4,
                        margin: "-2px -6px 0 0",
                        cursor: "pointer",
                        color: "#5b6472",
                        display: "flex",
                        borderRadius: 6,
                    }}
                >
                    <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M18 6 6 18" />
                        <path d="M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div
                style={{
                    padding: "18px 22px 20px",
                    maxHeight: "70vh",
                    overflowY: "auto",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        padding: 14,
                        border: "1px solid #e2e5ea",
                        borderRadius: 10,
                        background: "#f8f9fb",
                    }}
                >
                    {scheduled && (
                        <div
                            style={{
                                width: 48,
                                borderRadius: 12,
                                overflow: "hidden",
                                flexShrink: 0,
                                textAlign: "center",
                                border: "1px solid #b8d4f0",
                                background: "#e8f1fb",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase",
                                    color: "#14538c",
                                    padding: "4px 0 2px",
                                }}
                            >
                                {scheduled.format("MMM").toUpperCase()}
                            </div>
                            <div
                                style={{
                                    fontSize: 19,
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                    color: "#16294d",
                                }}
                            >
                                {scheduled.format("D")}
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "#5b6472",
                                    paddingBottom: 5,
                                }}
                            >
                                {scheduled.format("ddd")}
                            </div>
                        </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: "#1a1f2e",
                                }}
                            >
                                {meetingTypeLabel ||
                                    td("Meeting", { source: "en" })}
                            </span>
                        </div>
                        <div
                            style={{
                                fontSize: 13,
                                color: "#5b6472",
                                marginTop: 5,
                                lineHeight: 1.5,
                            }}
                        >
                            {scheduled
                                ? formatCompanyTime(meeting.scheduled_at)
                                : "--"}
                            {meeting.duration
                                ? ` (${meeting.duration} ${td("min", { source: "en" })})`
                                : ""}
                            {" · "}
                            {meeting.meeting_link
                                ? td("Online", { source: "en" })
                                : td("On site", { source: "en" })}
                        </div>
                        {meeting.location && (
                            <div
                                style={{
                                    fontSize: 13,
                                    color: "#5b6472",
                                    marginTop: 2,
                                    lineHeight: 1.5,
                                }}
                            >
                                {meeting.location}
                            </div>
                        )}
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginTop: 16,
                    }}
                >
                    {selectedOutcome === null &&
                        outcomes.map((outcome) => (
                            <button
                                key={outcome.key}
                                type="button"
                                onClick={() => setSelected(outcome.key)}
                                style={rowStyle(false)}
                            >
                                <span
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        flexShrink: 0,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: outcome.tone.bg,
                                        border: `1px solid ${outcome.tone.bd}`,
                                    }}
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke={outcome.tone.c}
                                        strokeWidth={1.5}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        {outcome.icon}
                                    </svg>
                                </span>
                                <span
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        textAlign: "left",
                                    }}
                                >
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: "#1a1f2e",
                                        }}
                                    >
                                        {outcome.label}
                                    </span>
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 12,
                                            color: "#5b6472",
                                            marginTop: 1,
                                        }}
                                    >
                                        {outcome.helper}
                                    </span>
                                </span>
                            </button>
                        ))}

                    {selectedOutcome !== null && (
                        <>
                            <div style={rowStyle(true)}>
                                <span
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        flexShrink: 0,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: selectedOutcome.tone.bg,
                                        border: `1px solid ${selectedOutcome.tone.bd}`,
                                    }}
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke={selectedOutcome.tone.c}
                                        strokeWidth={1.5}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        {selectedOutcome.icon}
                                    </svg>
                                </span>
                                <span
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        textAlign: "left",
                                    }}
                                >
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: "#1a1f2e",
                                        }}
                                    >
                                        {selectedOutcome.label}
                                    </span>
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 12,
                                            color: "#5b6472",
                                            marginTop: 1,
                                        }}
                                    >
                                        {selectedOutcome.helper}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelected(null)}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "#1890ff",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        padding: "4px 6px",
                                        flexShrink: 0,
                                    }}
                                >
                                    {td("Change", { source: "en" })}
                                </button>
                            </div>

                            <div style={{ marginTop: 4 }}>
                                <label
                                    htmlFor="meeting-attendance-note"
                                    style={{
                                        display: "block",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        lineHeight: 1.5,
                                        letterSpacing: "0.05em",
                                        textTransform: "uppercase",
                                        color: "#5b6472",
                                        marginBottom: 6,
                                    }}
                                >
                                    {noteLabel}
                                </label>
                                <textarea
                                    id="meeting-attendance-note"
                                    value={note}
                                    onChange={(event) =>
                                        setNote(event.target.value)
                                    }
                                    onFocus={() => setNoteFocused(true)}
                                    onBlur={() => setNoteFocused(false)}
                                    placeholder={td("Add an optional note…", {
                                        source: "en",
                                    })}
                                    rows={3}
                                    style={{
                                        width: "100%",
                                        resize: "vertical",
                                        border: `1px solid ${noteFocused ? "#b8d4f0" : "#e2e5ea"}`,
                                        borderRadius: 8,
                                        padding: "10px 12px",
                                        fontFamily: "inherit",
                                        fontSize: 13,
                                        color: "#1a1f2e",
                                        // Browser default focus ring can render as an odd
                                        // (sometimes red) outline depending on OS accent color;
                                        // replace it with the app's own blue focus treatment.
                                        outline: "none",
                                        boxShadow: noteFocused
                                            ? "0 0 0 2px #e8f1fb"
                                            : "none",
                                    }}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "14px 22px",
                    borderTop: "1px solid #eef0f3",
                    background: "#ffffff",
                }}
            >
                <button
                    type="button"
                    onClick={onDismiss}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.2,
                        padding: "9px 16px",
                        minHeight: 32,
                        borderRadius: 8,
                        cursor: "pointer",
                        background: TONE.red.bg,
                        color: TONE.red.c,
                        border: `1px solid ${TONE.red.bd}`,
                    }}
                >
                    {td("Cancel", { source: "en" })}
                </button>
                <button
                    type="button"
                    disabled={!selectedOutcome || confirmMutation.isPending}
                    onClick={handleConfirm}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.2,
                        padding: "9px 16px",
                        minHeight: 32,
                        borderRadius: 8,
                        background: "#1890ff",
                        color: "#ffffff",
                        border: "1px solid #1890ff",
                        cursor:
                            !selectedOutcome || confirmMutation.isPending
                                ? "not-allowed"
                                : "pointer",
                        opacity:
                            !selectedOutcome || confirmMutation.isPending
                                ? 0.45
                                : 1,
                    }}
                >
                    {selectedOutcome
                        ? confirmLabels[selectedOutcome.key]
                        : td("Confirm", { source: "en" })}
                </button>
            </div>
        </TaskModalShell>
    );
}
