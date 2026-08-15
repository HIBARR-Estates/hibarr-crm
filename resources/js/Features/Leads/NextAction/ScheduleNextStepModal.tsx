import { useTd } from "@/Hooks/useDynamicTranslation";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

interface ScheduleNextStepModalProps {
    open: boolean;
    onClose: () => void;
    onChoose: (type: "task" | "meeting") => void;
    leadName?: string;
}

function ChoiceCard({
    icon,
    bg,
    bd,
    fg,
    title,
    description,
    onClick,
}: {
    icon: string;
    bg: string;
    bd: string;
    fg: string;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-start gap-3 rounded-lg p-3.5 text-left transition-colors"
            style={{ border: `1px solid ${T.BORDER}`, background: T.WHITE }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.NAVY_MID)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.BORDER)}
        >
            <span
                className="flex-none inline-flex items-center justify-center rounded-md"
                style={{ width: 36, height: 36, background: bg, border: `1px solid ${bd}`, color: fg }}
            >
                <Icon name={icon} size={18} />
            </span>
            <span className="min-w-0">
                <span className="block" style={{ fontSize: 14, fontWeight: 600, color: T.TEXT }}>
                    {title}
                </span>
                <span className="block" style={{ fontSize: 12, color: T.TEXT_MUTED, marginTop: 2 }}>
                    {description}
                </span>
            </span>
        </button>
    );
}

/** Chooser shown before a task or meeting form — the lead has no next action yet. */
export default function ScheduleNextStepModal({
    open,
    onClose,
    onChoose,
    leadName,
}: ScheduleNextStepModalProps) {
    const { td } = useTd();

    return (
        <Modal
            open={open}
            title={td("Schedule next step", { source: "en" })}
            subtitle={leadName}
            onClose={onClose}
        >
            <div className="flex flex-col gap-2.5">
                <ChoiceCard
                    icon="check-square"
                    bg={T.TEAL_SOFT}
                    bd={T.TEAL_MID}
                    fg={T.TEAL}
                    title={td("Task", { source: "en" })}
                    description={td("A to-do with a due date, assigned to a teammate.", {
                        source: "en",
                    })}
                    onClick={() => onChoose("task")}
                />
                <ChoiceCard
                    icon="calendar"
                    bg={T.BLUE_LIGHT}
                    bd={T.BLUE_MID}
                    fg={T.BLUE_DARK}
                    title={td("Meeting", { source: "en" })}
                    description={td("A call or viewing booked with this lead.", {
                        source: "en",
                    })}
                    onClick={() => onChoose("meeting")}
                />
            </div>
        </Modal>
    );
}
