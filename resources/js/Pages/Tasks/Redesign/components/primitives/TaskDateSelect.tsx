import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useFloatingMenuPosition from "@/Components/Redesign/hooks/useFloatingMenuPosition";
import { TASK_ICON } from "../../config/taskDesignTokens";
import { TaskGlyph } from "./TaskGlyphs";

interface TaskDateSelectProps {
    startDate: string;
    dueDate: string;
    /** Stored as 24-hour `HH:mm`; the UI edits it as hour + minute + AM/PM. */
    dueTime: string;
    onChange: (next: {
        startDate?: string;
        dueDate?: string;
        dueTime?: string;
    }) => void;
    disabled?: boolean;
    error?: string | null;
}

type Meridiem = "AM" | "PM";

const FIELD: React.CSSProperties = {
    padding: "8px 10px",
    border: `1px solid ${T.BORDER}`,
    borderRadius: 8,
    fontSize: 15,
    color: T.TEXT,
    background: T.WHITE,
    width: "100%",
};

const MICRO: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: T.TEXT_MUTED,
};

/**
 * PHP date tokens for a 24-hour clock: `H` (leading zeros) and `G`. Anything
 * else (`h`, `g`) means the company runs a 12-hour clock, so the editor shows
 * an AM/PM toggle and caps the hour field at 12.
 */
function is24HourFormat(timeFormat: string | undefined): boolean {
    return /[HG]/.test(timeFormat ?? "H:i");
}

/**
 * Turns whatever was typed into a valid hour, rather than rejecting it.
 * On a 12-hour clock a 24-hour entry is converted: 14 becomes 2 PM, 0
 * becomes 12 AM. Out-of-range values clamp to the nearest legal hour.
 */
function normalizeTypedHour(
    raw: string,
    use24Hour: boolean,
    currentMeridiem: Meridiem,
): { hour: number; meridiem: Meridiem } {
    const typed = Number.parseInt(raw, 10);
    if (Number.isNaN(typed)) {
        return { hour: use24Hour ? 0 : 12, meridiem: currentMeridiem };
    }

    const clamped = Math.min(Math.max(typed, 0), 23);

    if (use24Hour) {
        return { hour: clamped, meridiem: clamped >= 12 ? "PM" : "AM" };
    }

    // 13–23 was meant as 24-hour input: fold it into the afternoon.
    if (clamped === 0) return { hour: 12, meridiem: "AM" };
    if (clamped === 12) return { hour: 12, meridiem: "PM" };
    if (clamped > 12) return { hour: clamped - 12, meridiem: "PM" };
    return { hour: clamped, meridiem: currentMeridiem };
}

/** 12-hour hour + meridiem → the 0–23 value a 24-hour field displays. */
function toStored24Hour(hour: number, meridiem: Meridiem): number {
    const base = hour % 12;
    return meridiem === "PM" ? base + 12 : base;
}

/** Clamps typed minutes to 0–59 and pads them. */
function normalizeTypedMinute(raw: string): string {
    const typed = Number.parseInt(raw, 10);
    if (Number.isNaN(typed)) return "00";
    return `${Math.min(Math.max(typed, 0), 59)}`.padStart(2, "0");
}

/** "2026-08-20" → "20 Aug". */
function shortDate(iso: string): string {
    if (!iso) return "";
    const date = new Date(`${iso}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
          });
}

/** "17:30" → { hour: 5, minute: "30", meridiem: "PM" }. */
function parseTime(value: string): {
    hour: number;
    minute: string;
    meridiem: Meridiem;
} {
    const [rawHour, rawMinute] = (value || "17:00").split(":");
    const hours24 = Number(rawHour);

    if (Number.isNaN(hours24)) {
        return { hour: 5, minute: "00", meridiem: "PM" };
    }

    return {
        hour: hours24 % 12 === 0 ? 12 : hours24 % 12,
        minute: (rawMinute ?? "00").padStart(2, "0"),
        meridiem: hours24 >= 12 ? "PM" : "AM",
    };
}

/** { 5, "30", "PM" } → "17:30". */
function toStoredTime(
    hour: number,
    minute: string,
    meridiem: Meridiem,
): string {
    let hours24 = hour % 12;
    if (meridiem === "PM") hours24 += 12;
    return `${`${hours24}`.padStart(2, "0")}:${minute}`;
}

/** "17:30" → "5:30 PM" on a 12-hour clock, "17:30" on a 24-hour one. */
function displayTime(value: string, use24Hour: boolean): string {
    const { hour, minute, meridiem } = parseTime(value);
    if (use24Hour) {
        const [rawHour] = (value || "17:00").split(":");
        return `${rawHour.padStart(2, "0")}:${minute}`;
    }
    return `${hour}:${minute} ${meridiem}`;
}

/**
 * Due-date pill and its editor. Deliberately minimal: two date fields plus a
 * typed hour/minute — no quick-pick presets, since choosing a day from
 * shortcuts was an extra step on top of the date field itself. The clock
 * follows the company time format, with an AM/PM toggle only on 12-hour.
 */
export default function TaskDateSelect({
    startDate,
    dueDate,
    dueTime,
    onChange,
    disabled = false,
    error,
}: TaskDateSelectProps) {
    const { td } = useTd();
    const { props } = usePage();
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, triggerRef, {
        align: "left",
        maxHeight: 420,
    });

    useEffect(() => {
        if (!open) return undefined;
        const onDocument = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocument);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("mousedown", onDocument);
            document.removeEventListener("keydown", onKey, true);
        };
    }, [open]);

    const { hour, minute, meridiem } = parseTime(dueTime);
    const hasDue = Boolean(dueDate);

    // 24-hour installs show 0–23 and no AM/PM; 12-hour installs show 1–12.
    const use24Hour = is24HourFormat(props.company?.time_format);
    const displayHour = use24Hour
        ? Number((dueTime || "17:00").split(":")[0]) || 0
        : hour;

    /**
     * The hour/minute fields are typed, so they hold their own text while the
     * user is mid-entry ("1" on the way to "14") and only normalise on blur.
     */
    const [hourText, setHourText] = useState(`${displayHour}`);
    const [minuteText, setMinuteText] = useState(minute);

    useEffect(() => {
        setHourText(`${displayHour}`);
        setMinuteText(minute);
    }, [displayHour, minute]);

    // "18 Aug – 20 Aug, 5:00 PM"
    const label = (() => {
        if (!startDate && !dueDate) return td("Set dates");
        if (!dueDate) return `${td("From")} ${shortDate(startDate)}`;
        const range = startDate
            ? `${shortDate(startDate)} – ${shortDate(dueDate)}`
            : shortDate(dueDate);
        return `${range}, ${displayTime(dueTime, use24Hour)}`;
    })();

    const setTime = (
        next: Partial<{ hour: number; minute: string; meridiem: Meridiem }>,
    ) =>
        onChange({
            dueTime: toStoredTime(
                next.hour ?? hour,
                next.minute ?? minute,
                next.meridiem ?? meridiem,
            ),
        });

    const commitHour = () => {
        const next = normalizeTypedHour(hourText, use24Hour, meridiem);
        setHourText(
            `${use24Hour ? toStored24Hour(next.hour, next.meridiem) : next.hour}`,
        );
        setTime({ hour: next.hour, meridiem: next.meridiem });
    };

    const commitMinute = () => {
        const next = normalizeTypedMinute(minuteText);
        setMinuteText(next);
        setTime({ minute: next });
    };

    const meridiemButton = (value: Meridiem) => {
        const active = meridiem === value;
        return (
            <button
                type="button"
                onClick={() => setTime({ meridiem: value })}
                style={{
                    padding: "6px 11px",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    cursor: "pointer",
                    background: active ? T.WHITE : "transparent",
                    color: active ? T.NAVY : T.TEXT_MUTED,
                }}
            >
                {value}
            </button>
        );
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen((current) => !current);
                }}
                className="tasks-press inline-flex items-center gap-1.5 whitespace-nowrap"
                style={{
                    padding: "7px 13px",
                    borderRadius: 6,
                    fontSize: 15,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    background: hasDue ? T.BLUE_LIGHT : T.WHITE,
                    color: hasDue ? T.BLUE_DARK : T.TEXT_MUTED,
                    border: `1px solid ${hasDue ? T.BLUE_MID : T.BORDER}`,
                    cursor: disabled ? "default" : "pointer",
                }}
            >
                <TaskGlyph d={TASK_ICON.calendar} size={13} strokeWidth={1.5} />
                {label}
                <span style={{ display: "flex", opacity: 0.6 }}>
                    <TaskGlyph
                        d={TASK_ICON.chevron}
                        size={11}
                        strokeWidth={1.5}
                    />
                </span>
            </button>

            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="dialog"
                        aria-label={td("Dates")}
                        className="tasks-reveal flex flex-col gap-3"
                        // Portals bubble React events up the component tree —
                        // without this the modal overlay would dismiss.
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            ...floatStyle,
                            width: 300,
                            padding: 14,
                            background: T.WHITE,
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: 12,
                            boxShadow:
                                "0 16px 36px rgba(22,41,77,0.16), 0 2px 6px rgba(22,41,77,0.06)",
                        }}
                    >
                        <label className="flex flex-col gap-1.5">
                            <span style={MICRO}>{td("Start date")}</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(event) =>
                                    onChange({ startDate: event.target.value })
                                }
                                style={FIELD}
                            />
                        </label>

                        <label className="flex flex-col gap-1.5">
                            <span style={MICRO}>{td("Due date")}</span>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(event) =>
                                    onChange({ dueDate: event.target.value })
                                }
                                style={FIELD}
                            />
                        </label>

                        <div className="flex flex-col gap-1.5">
                            <span style={MICRO}>{td("Due time")}</span>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    className="tasks-time-input"
                                    aria-label={td("Hour")}
                                    min={use24Hour ? 0 : 1}
                                    max={use24Hour ? 23 : 12}
                                    value={hourText}
                                    onChange={(event) =>
                                        setHourText(event.target.value)
                                    }
                                    onBlur={commitHour}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            commitHour();
                                        }
                                    }}
                                    style={{
                                        ...FIELD,
                                        flex: 1,
                                        minWidth: 0,
                                        textAlign: "center",
                                    }}
                                />

                                <span
                                    style={{ fontSize: 17, color: T.TEXT_HINT }}
                                >
                                    :
                                </span>

                                <input
                                    type="number"
                                    inputMode="numeric"
                                    className="tasks-time-input"
                                    aria-label={td("Minute")}
                                    min={0}
                                    max={59}
                                    value={minuteText}
                                    onChange={(event) =>
                                        setMinuteText(event.target.value)
                                    }
                                    onBlur={commitMinute}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            commitMinute();
                                        }
                                    }}
                                    style={{
                                        ...FIELD,
                                        flex: 1,
                                        minWidth: 0,
                                        textAlign: "center",
                                    }}
                                />

                                {/* AM/PM only exists in 12-hour locales. */}
                                {!use24Hour && (
                                    <div
                                        className="flex gap-0.5 p-0.5"
                                        style={{
                                            background: T.BG,
                                            border: `1px solid ${T.BORDER}`,
                                            borderRadius: 8,
                                        }}
                                    >
                                        {meridiemButton("AM")}
                                        {meridiemButton("PM")}
                                    </div>
                                )}
                            </div>
                        </div>

                        {error && (
                            <p style={{ fontSize: 14, color: T.RED }}>
                                {error}
                            </p>
                        )}

                        <div
                            className="flex items-center justify-between"
                            style={{
                                paddingTop: 10,
                                borderTop: `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    onChange({ dueDate: "", startDate: "" })
                                }
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: 0,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: T.TEXT_MUTED,
                                    cursor: "pointer",
                                }}
                            >
                                {td("Clear")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="tasks-press"
                                style={{
                                    padding: "6px 14px",
                                    borderRadius: 6,
                                    background: T.BLUE,
                                    color: T.WHITE,
                                    border: "none",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                {td("Done")}
                            </button>
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    );
}
