import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useFloatingMenuPosition from "@/Components/Redesign/hooks/useFloatingMenuPosition";
import { TASK_ICON } from "../../config/taskDesignTokens";
import { TaskGlyph } from "./TaskGlyphs";

/**
 * Reminder offsets, in minutes before the due date. Storing offsets rather
 * than absolute times is what makes "never after the due date" structural:
 * the due date is the anchor, so every reminder precedes it by construction.
 */
export const REMINDER_OPTIONS: Array<{ minutes: number; label: string }> = [
    { minutes: 60, label: "1 hour before" },
    { minutes: 60 * 24, label: "1 day before" },
    { minutes: 60 * 24 * 7, label: "1 week before" },
];

interface TaskReminderSelectProps {
    /** Selected offsets, in minutes before the due date. */
    value: number[];
    onChange: (minutes: number[]) => void;
    /** `YYYY-MM-DD`; reminders are unavailable without one. */
    dueDate: string;
    /** `HH:mm`. */
    dueTime: string;
    disabled?: boolean;
}

/** The moment an offset would fire, or null when there's no due date. */
function firesAt(
    dueDate: string,
    dueTime: string,
    minutes: number,
): Date | null {
    if (!dueDate) return null;
    const due = new Date(`${dueDate}T${dueTime || "17:00"}`);
    if (Number.isNaN(due.getTime())) return null;
    return new Date(due.getTime() - minutes * 60_000);
}

export default function TaskReminderSelect({
    value,
    onChange,
    dueDate,
    dueTime,
    disabled = false,
}: TaskReminderSelectProps) {
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, triggerRef, {
        align: "left",
        maxHeight: 320,
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

    // No due date means nothing to count back from.
    const unavailable = !dueDate;
    const active = value.length > 0 && !unavailable;

    const label = unavailable
        ? td("Reminder")
        : value.length === 0
          ? td("Reminder")
          : value.length === 1
            ? td(
                  REMINDER_OPTIONS.find((option) => option.minutes === value[0])
                      ?.label ?? "Reminder",
              )
            : `${value.length} ${td("reminders")}`;

    const toggle = (minutes: number) =>
        onChange(
            value.includes(minutes)
                ? value.filter((item) => item !== minutes)
                : [...value, minutes],
        );

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled || unavailable}
                title={
                    unavailable
                        ? td("Set a due date to add reminders")
                        : undefined
                }
                aria-haspopup="listbox"
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
                    background: active ? T.BLUE_LIGHT : T.WHITE,
                    color: active ? T.BLUE_DARK : T.TEXT_MUTED,
                    border: `1px solid ${active ? T.BLUE_MID : T.BORDER}`,
                    cursor: disabled || unavailable ? "default" : "pointer",
                    opacity: unavailable ? 0.55 : 1,
                }}
            >
                <TaskGlyph
                    d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
                    size={13}
                    strokeWidth={1.5}
                />
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
                        role="listbox"
                        aria-multiselectable="true"
                        className="tasks-reveal flex flex-col gap-1"
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            ...floatStyle,
                            overflowY: "auto",
                            minWidth: 250,
                            padding: 8,
                            background: T.WHITE,
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: 12,
                            boxShadow:
                                "0 16px 36px rgba(22,41,77,0.16), 0 2px 6px rgba(22,41,77,0.06)",
                        }}
                    >
                        <div
                            className="uppercase"
                            style={{
                                padding: "4px 8px 6px",
                                fontSize: 14,
                                fontWeight: 700,
                                letterSpacing: "0.05em",
                                color: T.TEXT_HINT,
                            }}
                        >
                            {td("Remind before due")}
                        </div>

                        {REMINDER_OPTIONS.map((option) => {
                            const checked = value.includes(option.minutes);
                            const at = firesAt(
                                dueDate,
                                dueTime,
                                option.minutes,
                            );
                            // An offset that lands in the past would never
                            // fire, so it can't be chosen.
                            const inPast =
                                at !== null && at.getTime() <= Date.now();
                            return (
                                <button
                                    key={option.minutes}
                                    type="button"
                                    role="option"
                                    aria-selected={checked}
                                    disabled={inPast && !checked}
                                    onClick={() => toggle(option.minutes)}
                                    className="tasks-status-option flex w-full items-center gap-2.5"
                                    style={{
                                        padding: "9px 10px",
                                        borderRadius: 8,
                                        border: "none",
                                        background: "transparent",
                                        cursor:
                                            inPast && !checked
                                                ? "default"
                                                : "pointer",
                                        opacity: inPast && !checked ? 0.45 : 1,
                                        textAlign: "left",
                                    }}
                                >
                                    <span
                                        className="flex flex-shrink-0 items-center justify-center"
                                        style={{
                                            width: 16,
                                            height: 16,
                                            borderRadius: 4,
                                            border: `1.5px solid ${checked ? T.BLUE : "#c7d0de"}`,
                                            background: checked
                                                ? T.BLUE
                                                : T.WHITE,
                                        }}
                                    >
                                        <TaskGlyph
                                            d={TASK_ICON.check}
                                            size={11}
                                            color={T.WHITE}
                                            strokeWidth={3}
                                        />
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span
                                            style={{
                                                fontSize: 15,
                                                fontWeight: checked ? 600 : 500,
                                                color: T.TEXT,
                                            }}
                                        >
                                            {td(option.label)}
                                        </span>
                                        {at && (
                                            <span
                                                style={{
                                                    fontSize: 14,
                                                    color: T.TEXT_HINT,
                                                }}
                                            >
                                                {inPast
                                                    ? td("Already passed")
                                                    : at.toLocaleString(
                                                          undefined,
                                                          {
                                                              day: "numeric",
                                                              month: "short",
                                                              hour: "numeric",
                                                              minute: "2-digit",
                                                          },
                                                      )}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>,
                    document.body,
                )}
        </>
    );
}
