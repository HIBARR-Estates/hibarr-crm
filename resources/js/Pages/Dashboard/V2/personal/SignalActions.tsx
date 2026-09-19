import { useState } from "react";
import { Button } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Severity } from "./types";
import SnoozeModal from "./SnoozeModal";

interface SignalActionsProps {
    severity: Severity;
    /** Shown as the snooze modal's subtitle. */
    taskName?: string;
    onComplete: () => void;
    /** A YYYY-MM-DD due date — the same shape tasks.reschedule always took. */
    onSnooze: (date: string) => void;
    /** The request each is actually in flight for — drives which button spins. */
    completing?: boolean;
    snoozing?: boolean;
    /** Already in the done column — completing again is a no-op. */
    done?: boolean;
}

/**
 * Complete, and snooze to a date the user actually picks.
 *
 * Snooze moves the due date through the existing tasks.reschedule endpoint —
 * that is the honest reading of it: nothing in this schema records "hidden
 * until", so a snooze that only hid the row would silently lose the task,
 * while a task that is genuinely due on the chosen date leaves the queue for
 * the right reason and comes back on its own. The button opens a short list
 * of dates rather than defaulting to "+1 day" silently.
 *
 * Both buttons are disabled while either request is in flight — completing
 * and snoozing the same task at once makes no sense — but only the one
 * actually running shows a spinner, so the row says which action it's
 * waiting on rather than just "something".
 *
 * Snooze is icon-only — Complete is the row's real action — but shares
 * .dr-btn's 32px min-height so the two sit level in the row.
 */
export default function SignalActions({
    severity,
    taskName,
    onComplete,
    onSnooze,
    completing = false,
    snoozing = false,
    done = false,
}: SignalActionsProps) {
    const { td } = useTd();
    const [snoozeOpen, setSnoozeOpen] = useState(false);
    const busy = completing || snoozing;

    return (
        <>
            {!done && (
                <Button
                    variant={severity === "now" ? "primary" : "ghost"}
                    loading={completing}
                    disabled={busy}
                    onClick={onComplete}
                >
                    {td("Complete")}
                </Button>
            )}

            <Button
                variant="ghost"
                title={td("Snooze")}
                aria-label={td("Snooze")}
                loading={snoozing}
                disabled={busy}
                onClick={() => setSnoozeOpen(true)}
                icon={
                    <svg
                        width={15}
                        height={15}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        style={{ display: "block" }}
                    >
                        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
                        <path d="M12 7v5l3 2" />
                    </svg>
                }
                style={{ width: 32, padding: 0, flex: "none" }}
            />

            <SnoozeModal
                open={snoozeOpen}
                taskName={taskName}
                snoozing={snoozing}
                onClose={() => setSnoozeOpen(false)}
                onSelect={onSnooze}
            />
        </>
    );
}
