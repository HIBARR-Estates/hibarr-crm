import { Icon } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import type { EmailQuickAction } from "@/Email/types";

interface DossierQuickActionsProps {
    onLogAction: () => void;
    onAddNote: () => void;
    onScheduleMeeting: () => void;
    /** Present only when crm.email is on and the user is allowlisted. */
    emailQuickAction?: EmailQuickAction | null;
    onEmail?: () => void;
}

type ActionId = "log" | "note" | "meeting" | "email";

type ActionDef = {
    id: ActionId;
    labelKey: string;
    titleKey: string;
    icon: "activity" | "file-text" | "calendar" | "mail";
    onClick: () => void;
};

export default function DossierQuickActions({
    onLogAction,
    onAddNote,
    onScheduleMeeting,
    emailQuickAction = null,
    onEmail,
}: DossierQuickActionsProps) {
    const { t } = useTranslation();

    const actions: ActionDef[] = [
        {
            id: "log",
            labelKey: "pages.leads.quick_actions.log",
            titleKey: "pages.leads.quick_actions.log_title",
            icon: "activity",
            onClick: onLogAction,
        },
        {
            id: "note",
            labelKey: "pages.leads.quick_actions.note",
            titleKey: "pages.leads.quick_actions.note_title",
            icon: "file-text",
            onClick: onAddNote,
        },
        {
            id: "meeting",
            labelKey: "pages.leads.quick_actions.meeting",
            titleKey: "pages.leads.quick_actions.meeting_title",
            icon: "calendar",
            onClick: onScheduleMeeting,
        },
    ];

    if (emailQuickAction != null && onEmail) {
        actions.push({
            id: "email",
            labelKey: emailQuickAction.has_connection
                ? "pages.leads.quick_actions.email"
                : "pages.leads.quick_actions.email_connect",
            titleKey: emailQuickAction.has_connection
                ? "pages.leads.quick_actions.email_title"
                : "pages.leads.quick_actions.email_connect_title",
            icon: "mail",
            onClick: onEmail,
        });
    }

    return (
        <section
            className="v2-quick-actions"
            data-tour="lead-quick-actions"
            aria-label={t("pages.leads.quick_actions.title")}
        >
            <h2 className="v2-quick-actions__title">
                {t("pages.leads.quick_actions.title")}
            </h2>
            <div className="v2-quick-actions__list">
                {actions.map((action) => (
                    <button
                        key={action.id}
                        type="button"
                        className="v2-quick-actions__btn"
                        onClick={action.onClick}
                        title={t(action.titleKey)}
                        aria-label={t(action.titleKey)}
                        data-action={action.id}
                    >
                        <Icon name={action.icon} size={18} />
                        <span className="v2-quick-actions__label">
                            {t(action.labelKey)}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}
