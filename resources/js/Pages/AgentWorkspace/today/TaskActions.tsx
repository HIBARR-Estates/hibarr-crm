import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";

interface TaskActionsProps {
    name: string;
    done: boolean;
    /** Late tasks get the filled button: they are the ones to clear first. */
    emphasis?: boolean;
    completing?: boolean;
    rescheduling?: boolean;
    /** Only Done (schedule rows); Reschedule stays in the task's own modal. */
    doneOnly?: boolean;
    size?: "sm" | "base";
    onComplete: () => void;
    onReschedule: () => void;
}

/** Done and Reschedule for one task. Both act on the screen first (see useTodayWork). */
export default function TaskActions({
    name,
    done,
    emphasis = false,
    completing = false,
    rescheduling = false,
    doneOnly = false,
    size = "base",
    onComplete,
    onReschedule,
}: TaskActionsProps) {
    const { t } = useTranslation();
    const busy = completing || rescheduling;

    if (done) {
        return (
            <span className="agent-task-done" aria-label={t("pages.agent_workspace.today.due.done")}>
                <Icon name="check" size={14} />
                {t("pages.agent_workspace.today.due.done")}
            </span>
        );
    }

    return (
        <div className="agent-task-actions">
            <Button
                variant={emphasis ? "primary" : "ghost"}
                size={size}
                icon={<Icon name="check" size={14} />}
                disabled={busy}
                onClick={onComplete}
                aria-label={t("pages.agent_workspace.today.actions.done_aria", { name })}
            >
                {t("pages.agent_workspace.today.actions.done")}
            </Button>
            {doneOnly ? null : (
            <Button
                variant="ghost"
                size={size}
                icon={<Icon name="clock" size={14} />}
                loading={rescheduling}
                disabled={busy}
                onClick={onReschedule}
                aria-label={t("pages.agent_workspace.today.actions.reschedule_aria", { name })}
                title={t("pages.agent_workspace.today.actions.reschedule")}
                className="agent-task-actions__reschedule"
            >
                <span className="agent-task-actions__label">{t("pages.agent_workspace.today.actions.reschedule")}</span>
            </Button>
            )}
        </div>
    );
}
