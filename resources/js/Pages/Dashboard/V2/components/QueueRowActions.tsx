import { useState } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface QueueRowActionsProps {
    onComplete: () => void;
    onReschedule: (dueDate: string) => void;
    /** Absent when the row has no CRM record to log against. */
    onLogActivity?: () => void;
    busy?: boolean;
    /** Already in the done column — completing again is a no-op. */
    done?: boolean;
}

/**
 * Complete and Reschedule, inline on a queue row.
 *
 * Reschedule reveals a native date input rather than opening a modal: it is a
 * one-field edit, and the platform already ships a date picker with a calendar,
 * keyboard handling and locale formatting. There is no Snooze — see NextUp.
 */
export default function QueueRowActions({
    onComplete,
    onReschedule,
    onLogActivity,
    busy = false,
    done = false,
}: QueueRowActionsProps) {
    const { td } = useTd();
    const [picking, setPicking] = useState(false);

    const today = new Date().toISOString().slice(0, 10);

    if (picking) {
        return (
            <input
                type="date"
                className="dr-input"
                autoFocus
                min={today}
                disabled={busy}
                aria-label={td("New due date")}
                style={{ width: 150, minHeight: 32 }}
                onBlur={() => setPicking(false)}
                onChange={(event) => {
                    if (!event.target.value) return;
                    onReschedule(event.target.value);
                    setPicking(false);
                }}
            />
        );
    }

    return (
        <>
            {onLogActivity && (
                <button
                    type="button"
                    className="dr-btn dr-btn-ghost"
                    disabled={busy}
                    style={{ color: T.TEXT_MUTED }}
                    onClick={onLogActivity}
                >
                    {td("Log activity")}
                </button>
            )}
            {!done && (
                <button
                    type="button"
                    className="dr-btn dr-btn-ghost"
                    disabled={busy}
                    onClick={onComplete}
                >
                    {td("Complete")}
                </button>
            )}
            <button
                type="button"
                className="dr-btn dr-btn-ghost"
                disabled={busy}
                style={{ color: T.TEXT_MUTED }}
                onClick={() => setPicking(true)}
            >
                {td("Reschedule")}
            </button>
        </>
    );
}
