import { useCallback, useEffect, useMemo, useState } from "react";
import { Dropdown, Popover } from "antd";
import { router } from "@inertiajs/react";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import NotificationAlertSettings from "@/Components/NotificationAlertSettings";
import { useNotificationAlertSettings } from "@/contexts/NotificationAlertSettingsContext";
import useNotificationIslandAlertsFlag from "@/Hooks/useNotificationIslandAlertsFlag";
import { useNotificationMutations, useNotificationSummary, useNotificationsList } from "@/Hooks/useNotifications";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import {
    acknowledgeDropdownNotifications,
    countUnacknowledgedNotifications,
    getDesktopPermission,
    isDesktopNotificationSupported,
    requestDesktopPermission,
} from "@/lib/notificationAlerts";
import { isSafeHttpUrl } from "@/lib/mapNotificationToAlert";
import { isPermissionAll, usePermission } from "@/lib/permissionUtils";
import type { Notification, NotificationFilterStatus } from "@/Types/api/notification";
import { groupByDay, notificationTime } from "./groupByDay";
import { notificationKind } from "./notificationKinds";
import "./notifications.css";

const POLL_MS = 30_000;
const PAGE_SIZE = 20;
const TABS: NotificationFilterStatus[] = ["all", "unread", "read"];

/**
 * The bell on the navy band (L7-36): a panel with All, Unread and Read, the
 * day's notifications grouped by day, mark-all-read and the alert settings.
 * It reads the CRM's own notification API, polling the unread summary for the
 * badge exactly as the classic bell does.
 */
export default function AgentNotificationBell() {
    const { t, locale } = useTranslation();
    const { timezone } = useUserDateTime();
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<NotificationFilterStatus>("all");
    // Bumped when the badge's acknowledged set changes, so it recounts without a refetch.
    const [ackVersion, setAckVersion] = useState(0);
    const nowMs = useMemo(() => Date.now(), [open, status]);

    const summary = useNotificationSummary(POLL_MS);
    const list = useNotificationsList({ status, per_page: PAGE_SIZE }, open);
    const { markAsRead, markAllAsRead, isMarkingRead } = useNotificationMutations();

    // The badge counts what arrived since the panel was last opened; opening clears it.
    const badge = useMemo(() => {
        void ackVersion;
        return countUnacknowledgedNotifications(summary.notifications);
    }, [summary.notifications, ackVersion]);

    const acknowledge = useCallback(() => {
        acknowledgeDropdownNotifications(summary.notifications);
        setAckVersion((version) => version + 1);
    }, [summary.notifications]);

    const onOpenChange = (next: boolean) => {
        setOpen(next);
        if (next) {
            acknowledge();
            void list.refetch();
        }
    };

    // While open, keep acknowledging so newly polled items don't light the bell behind the panel.
    useEffect(() => {
        if (open && summary.notifications.length > 0) acknowledge();
    }, [open, summary.notifications, acknowledge]);

    const quiet = { suppressSuccessToast: true } as const;
    const read = (notification: Notification) => {
        if (!notification.is_read) markAsRead({ id: notification.id }, quiet);
    };
    const openNotification = (notification: Notification) => {
        setOpen(false);
        const link = notification.link && isSafeHttpUrl(notification.link) ? notification.link : null;
        if (notification.is_read) {
            if (link) window.location.href = link;
            return;
        }
        // Leaving the page cancels a request still in flight, so the link waits for the read mark to settle (with a short cap so a slow network never blocks the click).
        let left = false;
        const go = () => {
            if (left || !link) return;
            left = true;
            window.location.href = link;
        };
        markAsRead({ id: notification.id }, { ...quiet, onSettled: go });
        if (link) window.setTimeout(go, 1500);
    };

    const groups = groupByDay(list.notifications, nowMs, timezone);
    const unread = summary.unreadCount;

    const panel = (
        <div className="agent-bell" role="dialog" aria-label={t("pages.agent_workspace.bell.title")}>
            <div className="agent-bell__head">
                <b>{t("pages.agent_workspace.bell.title")}</b>
                <span className="agent-bell__tools">
                    <Button size="sm" variant="ghost" disabled={unread === 0 || isMarkingRead} onClick={() => markAllAsRead({}, quiet)}>
                        <Icon name="check" size={13} />
                        {t("pages.agent_workspace.bell.mark_all")}
                    </Button>
                    <AlertSettings />
                </span>
            </div>

            <div className="agent-bell__tabs" role="tablist" aria-label={t("pages.agent_workspace.bell.title")}>
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={status === tab}
                        className="agent-bell__tab"
                        onClick={() => setStatus(tab)}
                    >
                        {tab === "unread" && unread > 0
                            ? t("pages.agent_workspace.bell.tabs.unread_count", { count: unread })
                            : t(`pages.agent_workspace.bell.tabs.${tab}`)}
                    </button>
                ))}
            </div>

            <div className="agent-bell__list">
                {list.isLoading ? (
                    <BellSkeleton />
                ) : list.error ? (
                    <div className="agent-bell__empty">
                        <p>{t("pages.agent_workspace.bell.failed")}</p>
                        <Button size="sm" variant="ghost" onClick={() => void list.refetch()}>
                            {t("pages.agent_workspace.bell.retry")}
                        </Button>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="agent-bell__empty">
                        <span className="agent-bell__empty-icon" aria-hidden="true">
                            <Icon name="bell" size={18} />
                        </span>
                        <p>{t(`pages.agent_workspace.bell.empty_${status}`)}</p>
                    </div>
                ) : (
                    groups.map((group) => (
                        <section key={group.key} className="agent-bell__group">
                            <h3 className="agent-bell__group-title">{t(`pages.agent_workspace.bell.${group.key}`)}</h3>
                            {group.items.map((notification) => (
                                <BellRow
                                    key={notification.id}
                                    notification={notification}
                                    when={notificationTime(notification.created_at, group.key, locale, timezone)}
                                    onOpen={openNotification}
                                    onRead={read}
                                />
                            ))}
                        </section>
                    ))
                )}
            </div>

            <div className="agent-bell__foot">
                <span>{t("pages.agent_workspace.bell.foot")}</span>
                <Button
                    size="sm"
                    className="agent-btn-soft"
                    onClick={() => {
                        setOpen(false);
                        router.visit(route("notifications.index"));
                    }}
                >
                    {t("pages.agent_workspace.bell.see_all")}
                    <Icon name="chevron-right" size={13} />
                </Button>
            </div>
        </div>
    );

    return (
        <Dropdown
            open={open}
            onOpenChange={onOpenChange}
            popupRender={() => panel}
            trigger={["click"]}
            placement="bottomRight"
            overlayClassName="agent-bell-pop"
        >
            <button
                type="button"
                className="agent-bell__button"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={badge > 0 ? t("pages.agent_workspace.bell.label_new", { count: badge }) : t("pages.agent_workspace.bell.title")}
            >
                <Icon name="bell" size={18} />
                {badge > 0 ? <span className="agent-bell__badge">{badge > 99 ? "99+" : badge}</span> : null}
            </button>
        </Dropdown>
    );
}

function BellRow({
    notification,
    when,
    onOpen,
    onRead,
}: {
    notification: Notification;
    when: string;
    onOpen: (notification: Notification) => void;
    onRead: (notification: Notification) => void;
}) {
    const { t } = useTranslation();
    const kind = notificationKind(notification.icon);
    const body = notification.text && notification.text !== notification.title ? notification.text : "";

    return (
        <div className={`agent-bell__row${notification.is_read ? "" : " agent-bell__row--unread"}`}>
            {notification.is_read ? (
                <span className="agent-bell__dot-slot" aria-hidden="true" />
            ) : (
                <button
                    type="button"
                    className="agent-bell__dot-button"
                    aria-label={t("pages.agent_workspace.bell.mark_read")}
                    title={t("pages.agent_workspace.bell.mark_read")}
                    onClick={() => onRead(notification)}
                >
                    <span className="agent-bell__dot" />
                </button>
            )}
            <button type="button" className="agent-bell__open" onClick={() => onOpen(notification)}>
                <span className="agent-bell__icon" style={{ ["--tint" as string]: `var(${kind.tint})` }} aria-hidden="true">
                    <Icon name={kind.icon} size={15} />
                </span>
                <span className="agent-bell__text">
                    <b>{notification.title}</b>
                    {body ? <small>{body}</small> : null}
                </span>
                <span className="agent-bell__when">{when}</span>
            </button>
        </div>
    );
}

function BellSkeleton() {
    return (
        <div className="agent-bell__skeleton" aria-hidden="true">
            {[0, 1, 2, 3].map((row) => (
                <div key={row} className="agent-bell__skeleton-row">
                    <span />
                    <span />
                </div>
            ))}
        </div>
    );
}

/** The gear: where alerts appear, how long they stay, and the sound and desktop alert switch. */
function AlertSettings() {
    const { t } = useTranslation();
    const islandAlertsEnabled = useNotificationIslandAlertsFlag();
    const { permissions } = usePermission();
    const {
        settings: { alerts_muted: muted },
        setAlertsMuted,
    } = useNotificationAlertSettings();
    const canManage = isPermissionAll(permissions.manage_notification_setting);

    if (!islandAlertsEnabled && !canManage) return null;

    // Turning alerts on needs a user gesture to ask for desktop permission, so it happens in the click.
    const toggle = () => {
        const nextMuted = !muted;
        setAlertsMuted(nextMuted);
        if (!nextMuted && isDesktopNotificationSupported() && getDesktopPermission() === "default") requestDesktopPermission();
    };

    return (
        <Popover
            trigger="click"
            placement="bottomRight"
            // The theme raises the dropdown popup to 1350; the popover needs to sit above it.
            zIndex={1400}
            content={
                <div className="agent-bell__settings">
                    {islandAlertsEnabled ? (
                        <>
                            <NotificationAlertSettings />
                            <Button size="sm" variant="ghost" onClick={toggle}>
                                <Icon name={muted ? "eye-off" : "bell"} size={13} />
                                {muted ? t("pages.agent_workspace.bell.alerts_on") : t("pages.agent_workspace.bell.alerts_off")}
                            </Button>
                        </>
                    ) : null}
                    {canManage ? (
                        <Button size="sm" variant="ghost" onClick={() => router.visit(route("notification-settings-manager.index"))}>
                            {t("pages.agent_workspace.bell.manage")}
                        </Button>
                    ) : null}
                </div>
            }
        >
            <Button size="sm" variant="ghost" aria-label={t("pages.agent_workspace.bell.settings")} title={t("pages.agent_workspace.bell.settings")}>
                <Icon name="sliders" size={14} />
            </Button>
        </Popover>
    );
}
