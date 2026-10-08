import { Icon } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import type { EmailQuickAction } from "@/Email/types";
import useEmailUnreadCount from "@/Email/hooks/useEmailUnreadCount";

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
    const { unread: emailUnread, available: emailUnreadAvailable } =
        useEmailUnreadCount({
            enabled: emailQuickAction != null,
            pollingInterval: 60_000,
        });

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
                {actions.map((action) => {
                    const showUnreadDot =
                        action.id === "email" &&
                        emailUnreadAvailable &&
                        emailUnread > 0;
                    const ariaLabel =
                        showUnreadDot
                            ? t("pages.email.indicator.unread_aria").replace(
                                  "{{count}}",
                                  String(emailUnread),
                              )
                            : t(action.titleKey);

                    return (
                        <button
                            key={action.id}
                            type="button"
                            className="v2-quick-actions__btn"
                            onClick={action.onClick}
                            title={ariaLabel}
                            aria-label={ariaLabel}
                            data-action={action.id}
                            data-email-unread={
                                action.id === "email" && emailUnreadAvailable
                                    ? emailUnread
                                    : undefined
                            }
                        >
                            <span className="relative inline-flex">
                                <Icon name={action.icon} size={18} />
                                {showUnreadDot ? (
                                    <span
                                        className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-dr-red"
                                        aria-hidden="true"
                                        data-tour="lead-email-unread-dot"
                                    />
                                ) : null}
                            </span>
                            <span className="v2-quick-actions__label">
                                {t(action.labelKey)}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
