import { Icon } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface DossierQuickActionsProps {
    onLogAction: () => void;
    onAddNote: () => void;
    onScheduleMeeting: () => void;
}

const ACTIONS = [
    {
        id: "log",
        label: "Log Action",
        title: "Log an action",
        icon: "activity",
        handler: "onLogAction" as const,
    },
    {
        id: "note",
        label: "Add Note",
        title: "Take a note",
        icon: "file-text",
        handler: "onAddNote" as const,
    },
    {
        id: "meeting",
        label: "Schedule Meeting",
        title: "Schedule a meeting",
        icon: "calendar",
        handler: "onScheduleMeeting" as const,
    },
] as const;

export default function DossierQuickActions({
    onLogAction,
    onAddNote,
    onScheduleMeeting,
}: DossierQuickActionsProps) {
    const { td } = useTd();

    const handlers = {
        onLogAction,
        onAddNote,
        onScheduleMeeting,
    };

    return (
        <section
            className="v2-quick-actions"
            data-tour="lead-quick-actions"
            aria-label={td("Quick actions")}
        >
            <h2 className="v2-quick-actions__title">{td("Quick actions")}</h2>
            <div className="v2-quick-actions__list">
                {ACTIONS.map((action) => (
                    <button
                        key={action.id}
                        type="button"
                        className="v2-quick-actions__btn"
                        onClick={handlers[action.handler]}
                        title={td(action.title)}
                        aria-label={td(action.title)}
                    >
                        <Icon name={action.icon} size={18} />
                        <span className="v2-quick-actions__label">
                            {td(action.label)}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}
