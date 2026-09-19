import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Button, Modal, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface SnoozeOption {
    key: string;
    /** English source string — translated at render. */
    label: string;
    /** Short badge text — "1D", "3D", "7D". Not translated; it's a count, not prose. */
    badge: string;
    bg: string;
    color: string;
    date: () => string;
}

const OPTIONS: SnoozeOption[] = [
    {
        key: "tomorrow",
        label: "Tomorrow",
        badge: "1D",
        bg: T.AMBER_SOFT,
        color: T.AMBER,
        date: () => dayjs().add(1, "day").format("YYYY-MM-DD"),
    },
    {
        key: "3days",
        label: "In 3 days",
        badge: "3D",
        bg: T.BLUE_LIGHT,
        color: T.BLUE_DARK,
        date: () => dayjs().add(3, "day").format("YYYY-MM-DD"),
    },
    {
        key: "week",
        label: "Next week",
        badge: "7D",
        bg: T.NAVY_SOFT,
        color: T.NAVY,
        date: () => dayjs().add(7, "day").format("YYYY-MM-DD"),
    },
];

const CUSTOM_KEY = "custom";

const CALENDAR_PATH =
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z";

interface SnoozeModalProps {
    open: boolean;
    /** What's being snoozed, shown as the modal's subtitle. */
    taskName?: string;
    /** Whether the reschedule this modal started is still in flight. */
    snoozing: boolean;
    onClose: () => void;
    /** A YYYY-MM-DD due date — the same shape tasks.reschedule always took. */
    onSelect: (date: string) => void;
}

/** A small spinner that fits the 32px badge slot — same border-spin technique as Button's own `loading`. */
function Spinner({ color = "currentColor" }: { color?: string }) {
    return (
        <span
            aria-hidden
            className="animate-spin"
            style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                border: `2px solid ${color}`,
                borderTopColor: "transparent",
                display: "block",
            }}
        />
    );
}

/**
 * A real move of the due date, offered as a short list rather than a single
 * "+1 day" default — see SignalActions for why this reuses Reschedule
 * instead of a hidden "snoozed until" flag nothing in the schema records.
 *
 * Each preset states the actual date it resolves to, not just the relative
 * label — "Tomorrow" alone doesn't say whether that's a Friday or a Monday,
 * and this is a real commitment to a date, not a vague gesture. Picking a
 * custom date is a two-step: choosing a date swaps that row into an inline
 * "Snooze to <date>?" confirmation rather than committing on change, the one
 * row here whose value isn't already spelled out before it's clicked.
 *
 * The row that was clicked keeps the modal open and shows its own spinner
 * until the request settles, then the modal closes itself — the queue row
 * underneath is already updated optimistically, this is only so the click
 * itself doesn't feel like it went nowhere.
 */
export default function SnoozeModal({
    open,
    taskName,
    snoozing,
    onClose,
    onSelect,
}: SnoozeModalProps) {
    const { td } = useTd();
    const today = dayjs().format("YYYY-MM-DD");
    const [pendingDate, setPendingDate] = useState<string | null>(null);
    const [pendingKey, setPendingKey] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setPendingDate(null);
            setPendingKey(null);
        }
    }, [open]);

    // The request this modal kicked off just settled — close, whether it
    // succeeded or failed. A failure already rolled the row back and toasted
    // separately; there's nothing left for this modal to say about it.
    useEffect(() => {
        if (pendingKey && !snoozing) {
            onClose();
        }
    }, [snoozing, pendingKey, onClose]);

    const choose = (key: string, date: string) => {
        setPendingKey(key);
        onSelect(date);
    };

    return (
        <Modal
            open={open}
            title={td("Snooze")}
            subtitle={taskName}
            onClose={onClose}
            maxWidth={400}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {OPTIONS.map((option) => {
                    const date = option.date();
                    const isPending = pendingKey === option.key;

                    return (
                        <button
                            key={option.key}
                            type="button"
                            className="dv2-snooze-option"
                            disabled={pendingKey !== null}
                            onClick={() => choose(option.key, date)}
                        >
                            <span
                                aria-hidden
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 999,
                                    flex: "none",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: option.bg,
                                    color: option.color,
                                    fontSize: 11,
                                    fontWeight: 700,
                                }}
                            >
                                {isPending ? (
                                    <Spinner color={option.color} />
                                ) : (
                                    option.badge
                                )}
                            </span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span
                                    style={{
                                        display: "block",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: T.TEXT,
                                    }}
                                >
                                    {td(option.label)}
                                </span>
                                <span
                                    style={{
                                        display: "block",
                                        fontSize: 12,
                                        color: T.TEXT_HINT,
                                        marginTop: 1,
                                    }}
                                >
                                    {dayjs(date).format("ddd, D MMM")}
                                </span>
                            </span>
                        </button>
                    );
                })}

                <div
                    className="dv2-snooze-option"
                    style={{
                        cursor: "default",
                        ...(pendingDate
                            ? { background: T.BLUE_LIGHT, borderColor: T.BLUE_MID }
                            : {}),
                    }}
                >
                    <span
                        aria-hidden
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 999,
                            flex: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: pendingDate ? T.SURFACE : T.GRAY,
                        }}
                    >
                        {pendingKey === CUSTOM_KEY ? (
                            <Spinner color={T.TEXT_MUTED} />
                        ) : (
                            <svg
                                width={16}
                                height={16}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke={T.TEXT_MUTED}
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ display: "block" }}
                            >
                                <path d={CALENDAR_PATH} />
                            </svg>
                        )}
                    </span>

                    {pendingDate ? (
                        <>
                            <span
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    fontSize: 13.5,
                                    fontWeight: 600,
                                    color: T.NAVY,
                                }}
                            >
                                {td("Snooze to")}{" "}
                                {dayjs(pendingDate).format("ddd, D MMM")}?
                            </span>
                            <Button
                                variant="primary"
                                size="sm"
                                loading={pendingKey === CUSTOM_KEY}
                                disabled={
                                    pendingKey !== null &&
                                    pendingKey !== CUSTOM_KEY
                                }
                                onClick={() => choose(CUSTOM_KEY, pendingDate)}
                            >
                                {td("Confirm")}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={pendingKey !== null}
                                onClick={() => setPendingDate(null)}
                            >
                                {td("Cancel")}
                            </Button>
                        </>
                    ) : (
                        <>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span
                                    style={{
                                        display: "block",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: T.TEXT,
                                    }}
                                >
                                    {td("Pick a date")}
                                </span>
                                <span
                                    style={{
                                        display: "block",
                                        fontSize: 12,
                                        color: T.TEXT_HINT,
                                        marginTop: 1,
                                    }}
                                >
                                    {td("Choose any day")}
                                </span>
                            </span>
                            <input
                                type="date"
                                className="dr-input"
                                min={today}
                                disabled={pendingKey !== null}
                                aria-label={td("Pick a date")}
                                style={{ width: 118, minHeight: 32, flex: "none" }}
                                onChange={(event) => {
                                    if (event.target.value) {
                                        setPendingDate(event.target.value);
                                    }
                                }}
                            />
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
}
