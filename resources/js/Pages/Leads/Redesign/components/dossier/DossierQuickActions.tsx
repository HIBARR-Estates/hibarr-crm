import { message } from "antd";
import { usePage } from "@inertiajs/react";
import { Icon } from "@/Components/Redesign";
import ClickToCallButton from "@/Components/ClickToCallButton";
import useClickToCall from "@/Hooks/useClickToCall";
import useTranslation from "@/Hooks/useTranslation";
import type { EmailQuickAction } from "@/Email/types";
import useEmailUnreadCount from "@/Email/hooks/useEmailUnreadCount";
import { isMeaningfulDossierValue } from "../../adapters/dossierAdapter";

interface DossierQuickActionsProps {
    leadId?: number;
    phone?: string | null;
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
    leadId,
    phone,
    onLogAction,
    onAddNote,
    onScheduleMeeting,
    emailQuickAction = null,
    onEmail,
}: DossierQuickActionsProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const { isEnabled: olEnabled } = useClickToCall();
    const { unread: emailUnread, available: emailUnreadAvailable } =
        useEmailUnreadCount({
            enabled: emailQuickAction != null,
            pollingInterval: 60_000,
        });

    const trimmedPhone =
        phone && isMeaningfulDossierValue(phone) ? phone.trim() : "";
    const softphonePermission = props.auth?.permissions?.make_softphone_calls;
    const softphoneEnabled =
        (softphonePermission === "all" || softphonePermission === "added") &&
        props.featureFlags?.["crm.softphone"] === true;
    const useTelephonyButton =
        (softphoneEnabled || olEnabled) &&
        Boolean(trimmedPhone) &&
        typeof leadId === "number";

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
            labelKey: "pages.email.communication.open",
            titleKey: "pages.email.communication.title",
            icon: "mail",
            onClick: onEmail,
        });
    }

    const callButtonChildren = (
        <>
            <span className="relative inline-flex">
                <Icon name="phone" size={18} />
            </span>
            <span className="v2-quick-actions__label">
                {t("pages.leads.quick_actions.call")}
            </span>
        </>
    );

    const callTitle = trimmedPhone
        ? t("pages.leads.quick_actions.call_title")
        : t("pages.leads.quick_actions.no_phone");

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
                {useTelephonyButton ? (
                    <ClickToCallButton
                        phone={trimmedPhone}
                        entity={{ type: "lead", id: leadId! }}
                        variant="link"
                        className="v2-quick-actions__btn"
                        title={callTitle}
                        ariaLabel={callTitle}
                        dataAction="call"
                    >
                        {callButtonChildren}
                    </ClickToCallButton>
                ) : (
                    <button
                        type="button"
                        className="v2-quick-actions__btn"
                        onClick={() => {
                            if (!trimmedPhone) {
                                message.warning(
                                    t("pages.leads.quick_actions.no_phone"),
                                );
                                return;
                            }
                            window.open(
                                `tel:${trimmedPhone.replace(/[^\d+]/g, "")}`,
                                "_self",
                            );
                        }}
                        title={callTitle}
                        aria-label={callTitle}
                        data-action="call"
                    >
                        {callButtonChildren}
                    </button>
                )}

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
