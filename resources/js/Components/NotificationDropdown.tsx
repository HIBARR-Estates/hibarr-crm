import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
    Badge,
    Dropdown,
    Button,
    List,
    Typography,
    Skeleton,
    Empty,
    Tooltip,
    Popover,
} from "antd";
import {
    BellOutlined,
    CheckOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    MessageOutlined,
    FileTextOutlined,
    DollarOutlined,
    CalendarOutlined,
    UserOutlined,
    ProjectOutlined,
    ExclamationCircleOutlined,
    GiftOutlined,
    FileProtectOutlined,
    CommentOutlined,
    ScheduleOutlined,
    RiseOutlined,
    RightOutlined,
    SoundOutlined,
    SoundFilled,
    SettingOutlined,
    CloseOutlined,
} from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import {
    useNotificationSummary,
    useNotificationMutations,
} from "@/Hooks/useNotifications";
import type { Notification, NotificationIcon } from "@/Types/api/notification";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
    isDesktopNotificationSupported,
    getDesktopPermission,
    requestDesktopPermission,
    acknowledgeDropdownNotifications,
    countUnacknowledgedNotifications,
    isDistinctNotificationBody,
} from "@/lib/notificationAlerts";
import { isSafeHttpUrl } from "@/lib/mapNotificationToAlert";
import NotificationAlertSettings from "@/Components/NotificationAlertSettings";
import useNotificationIslandAlertsFlag from "@/Hooks/useNotificationIslandAlertsFlag";
import { useNotificationAlertSettings } from "@/contexts/NotificationAlertSettingsContext";
import { usePermission, isPermissionAll } from "@/lib/permissionUtils";
import { router } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;

/**
 * Get the appropriate icon component for a notification type
 */
const getNotificationIcon = (icon: NotificationIcon): React.ReactNode => {
    const iconMap: Record<NotificationIcon, React.ReactNode> = {
        task: <CheckOutlined style={{ color: "#1890ff" }} />,
        "task-completed": <CheckCircleOutlined style={{ color: "#52c41a" }} />,
        comment: <CommentOutlined style={{ color: "#722ed1" }} />,
        notice: <FileTextOutlined style={{ color: "#fa8c16" }} />,
        chat: <MessageOutlined style={{ color: "#13c2c2" }} />,
        ticket: <ExclamationCircleOutlined style={{ color: "#f5222d" }} />,
        lead: <UserOutlined style={{ color: "#1890ff" }} />,
        deal: <DollarOutlined style={{ color: "#52c41a" }} />,
        project: <ProjectOutlined style={{ color: "#722ed1" }} />,
        expense: <DollarOutlined style={{ color: "#fa8c16" }} />,
        invoice: <FileProtectOutlined style={{ color: "#52c41a" }} />,
        leave: <CalendarOutlined style={{ color: "#1890ff" }} />,
        "leave-approved": <CheckCircleOutlined style={{ color: "#52c41a" }} />,
        "leave-rejected": (
            <ExclamationCircleOutlined style={{ color: "#f5222d" }} />
        ),
        event: <CalendarOutlined style={{ color: "#722ed1" }} />,
        appreciation: <GiftOutlined style={{ color: "#eb2f96" }} />,
        birthday: <GiftOutlined style={{ color: "#fa8c16" }} />,
        contract: <FileProtectOutlined style={{ color: "#1890ff" }} />,
        discussion: <CommentOutlined style={{ color: "#13c2c2" }} />,
        shift: <ScheduleOutlined style={{ color: "#fa8c16" }} />,
        promotion: <RiseOutlined style={{ color: "#52c41a" }} />,
        reminder: <ClockCircleOutlined style={{ color: "#1890ff" }} />,
        bell: <BellOutlined style={{ color: "#8c8c8c" }} />,
    };

    return iconMap[icon] || iconMap.bell;
};

/**
 * Single notification item in the dropdown
 */
interface NotificationItemProps {
    notification: Notification;
    onDismiss: (id: string) => void;
    onClick: (notification: Notification) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
    notification,
    onDismiss,
    onClick,
}) => {
    const handleClick = useCallback(() => {
        onClick(notification);
    }, [notification, onClick]);

    const handleDismiss = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onDismiss(notification.id);
        },
        [notification.id, onDismiss],
    );

    const showBody = isDistinctNotificationBody(
        notification.title,
        notification.text,
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2 }}
            layout
        >
            <List.Item
                onClick={handleClick}
                className={`group cursor-pointer transition-all hover:bg-gray-50 ${
                    !notification.is_read ? "bg-blue-50/50" : ""
                }`}
                style={{
                    padding: "8px 12px",
                    alignItems: "flex-start",
                    gap: 8,
                }}
            >
                <List.Item.Meta
                    style={{ alignItems: "flex-start", margin: 0 }}
                    avatar={
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
                                !notification.is_read
                                    ? "bg-blue-100"
                                    : "bg-gray-100"
                            }`}
                        >
                            {getNotificationIcon(notification.icon)}
                        </div>
                    }
                    title={
                        <div className="flex items-start justify-between gap-2">
                            <Text
                                strong={!notification.is_read}
                                className="text-sm max-w-[220px] !mb-0 leading-snug"
                            >
                                {notification.title}
                            </Text>
                            <Tooltip title="Clear">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={
                                        <CloseOutlined className="text-gray-400 text-xs" />
                                    }
                                    onClick={handleDismiss}
                                    className="opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0 -mt-0.5"
                                    aria-label="Clear notification"
                                />
                            </Tooltip>
                        </div>
                    }
                    description={
                        <div className="!mt-0.5 space-y-0.5">
                            {showBody ? (
                                <Paragraph
                                    ellipsis={{ rows: 2 }}
                                    className="!mb-0 text-xs text-gray-500 leading-snug"
                                >
                                    {notification.text}
                                </Paragraph>
                            ) : null}
                            <div className="flex items-center gap-1">
                                <ClockCircleOutlined className="text-gray-400 text-[10px]" />
                                <Text className="text-[11px] text-gray-400 leading-none">
                                    {notification.time_ago}
                                </Text>
                            </div>
                        </div>
                    }
                />
                {!notification.is_read && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1890ff] mt-2 flex-shrink-0" />
                )}
            </List.Item>
        </motion.div>
    );
};

/**
 * Props for the NotificationDropdown component
 */
interface NotificationDropdownProps {
    className?: string;
    pollingInterval?: number;
}

/**
 * Notification dropdown component with bell icon and unread badge.
 * Shows a preview of recent notifications with polling for updates.
 *
 * Bell badge = notifications arrived since the dropdown was last opened.
 * Opening the dropdown clears the badge but keeps the full unread list visible.
 */
const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
    className = "",
    pollingInterval = 30000,
}) => {
    const [open, setOpen] = useState(false);
    // Bump when acknowledgment changes so badge recalculates without a refetch.
    const [ackVersion, setAckVersion] = useState(0);
    const {
        settings: { alerts_muted: alertsMuted },
        setAlertsMuted,
    } = useNotificationAlertSettings();
    const islandAlertsEnabled = useNotificationIslandAlertsFlag();
    const { permissions } = usePermission();
    const canManageNotifications = isPermissionAll(
        permissions.manage_notification_setting,
    );
    const { t } = useTranslation();

    const { notifications, isLoading, refetch } =
        useNotificationSummary(pollingInterval);

    const badgeCount = useMemo(() => {
        void ackVersion;
        return countUnacknowledgedNotifications(notifications);
    }, [notifications, ackVersion]);

    // Toggling sound/popup alerts on requires a user gesture to request
    // desktop notification permission — browsers silently auto-deny requests
    // fired without one, so this must happen inside the click handler.
    const handleToggleAlerts = useCallback(() => {
        const nextMuted = !alertsMuted;
        setAlertsMuted(nextMuted);

        if (
            !nextMuted &&
            isDesktopNotificationSupported() &&
            getDesktopPermission() === "default"
        ) {
            requestDesktopPermission();
        }
    }, [alertsMuted, setAlertsMuted]);

    const { markAsReadQuiet, markAllAsRead, isMarkingRead } =
        useNotificationMutations();

    const handleOpenChange = useCallback(
        (nextOpen: boolean) => {
            setOpen(nextOpen);
            if (nextOpen) {
                acknowledgeDropdownNotifications(notifications);
                setAckVersion((v) => v + 1);
                void refetch();
            }
        },
        [notifications, refetch],
    );

    // While the panel is open, keep acknowledging so the bell stays clear and
    // newly polled items still appear in the list without bumping the badge.
    useEffect(() => {
        if (!open || notifications.length === 0) return;
        acknowledgeDropdownNotifications(notifications);
        setAckVersion((v) => v + 1);
    }, [open, notifications]);

    // Handle notification click — mark read then navigate
    const handleNotificationClick = useCallback(
        (notification: Notification) => {
            setOpen(false);
            if (!notification.is_read) {
                markAsReadQuiet(notification.id);
            }
            if (notification.link && isSafeHttpUrl(notification.link)) {
                window.location.href = notification.link;
            }
        },
        [markAsReadQuiet],
    );

    // Clear (X) — remove from dropdown list by marking read
    const handleDismiss = useCallback(
        (id: string) => {
            markAsReadQuiet(id);
            acknowledgeDropdownNotifications([{ id }]);
            setAckVersion((v) => v + 1);
        },
        [markAsReadQuiet],
    );

    // Handle mark all as read
    const handleMarkAllRead = useCallback(() => {
        acknowledgeDropdownNotifications(notifications);
        setAckVersion((v) => v + 1);
        markAllAsRead({});
    }, [markAllAsRead, notifications]);

    // Handle view all click
    const handleViewAll = useCallback(() => {
        setOpen(false);
        window.location.href = route("notifications.index");
    }, []);

    // Dropdown content
    const dropdownContent = (
        <div
            className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
            style={{ width: 380, maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BellOutlined className="text-lg" />
                    <Text strong>Notifications</Text>
                    {notifications.length > 0 && (
                        <Badge
                            count={notifications.length}
                            className="ml-1"
                            style={{ backgroundColor: "#1890ff" }}
                        />
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {islandAlertsEnabled && (
                        <Popover
                            content={
                                <>
                                    <NotificationAlertSettings />
                                    {canManageNotifications && (
                                        <div className="mt-2 border-t border-gray-100 pt-2">
                                            <Button
                                                type="link"
                                                size="small"
                                                className="!px-0"
                                                onClick={() =>
                                                    router.visit(
                                                        route(
                                                            "notification-settings-manager.index",
                                                        ),
                                                    )
                                                }
                                            >
                                                {t("app.menu.notificationSettings")}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            }
                            trigger="click"
                            placement="bottomRight"
                            // Theme raises zIndexPopupBase to 1300 (see
                            // providers/antd/utils.ts), which puts this
                            // Dropdown's own popup at 1350. Popover's default
                            // offset is always 20 below Dropdown's, so it needs
                            // an explicit bump to actually render on top.
                            zIndex={1400}
                        >
                            <Tooltip title="Alert settings">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={
                                        <SettingOutlined className="text-gray-400" />
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </Tooltip>
                        </Popover>
                    )}
                    {islandAlertsEnabled && (
                        <Tooltip
                            title={
                                alertsMuted
                                    ? "Turn on sound + desktop alerts"
                                    : "Mute sound + desktop alerts"
                            }
                        >
                            <Button
                                type="text"
                                size="small"
                                icon={
                                    alertsMuted ? (
                                        <SoundOutlined className="text-gray-400" />
                                    ) : (
                                        <SoundFilled className="text-[#1890ff]" />
                                    )
                                }
                                onClick={handleToggleAlerts}
                            />
                        </Tooltip>
                    )}
                    {notifications.length > 0 && (
                        <Button
                            type="link"
                            size="small"
                            onClick={handleMarkAllRead}
                            loading={isMarkingRead}
                            className="text-xs"
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>
            </div>

            {/* Notification list */}
            <div
                className="overflow-y-auto"
                style={{ maxHeight: "calc(80vh - 120px)" }}
            >
                {isLoading ? (
                    <div className="p-4">
                        <Skeleton active avatar paragraph={{ rows: 2 }} />
                        <Skeleton active avatar paragraph={{ rows: 2 }} />
                        <Skeleton active avatar paragraph={{ rows: 2 }} />
                    </div>
                ) : notifications.length > 0 ? (
                    <List
                        dataSource={notifications}
                        renderItem={(notification) => (
                            <NotificationItem
                                key={notification.id}
                                notification={notification}
                                onDismiss={handleDismiss}
                                onClick={handleNotificationClick}
                            />
                        )}
                        split={false}
                    />
                ) : (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No new notifications"
                        className="py-8"
                    />
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                <Button
                    type="link"
                    block
                    onClick={handleViewAll}
                    className="flex items-center justify-center gap-1"
                >
                    View all notifications
                    <RightOutlined className="text-xs" />
                </Button>
            </div>
        </div>
    );

    return (
        <Dropdown
            popupRender={() => dropdownContent}
            trigger={["click"]}
            open={open}
            onOpenChange={handleOpenChange}
            placement="bottomRight"
        >
            <div className={`cursor-pointer relative ${className}`}>
                <Badge
                    count={badgeCount}
                    overflowCount={99}
                    offset={[-2, 2]}
                    size="small"
                >
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <Button
                            type="text"
                            icon={
                                <BellOutlined
                                    className={`text-xl ${
                                        badgeCount > 0
                                            ? "text-blue-500"
                                            : "text-gray-500"
                                    }`}
                                />
                            }
                            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100"
                        />
                    </motion.div>
                </Badge>
                {/* Pulse animation for new (unacknowledged) notifications */}
                <AnimatePresence>
                    {badgeCount > 0 && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1.5, opacity: 0 }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                repeatType: "loop",
                            }}
                            className="absolute top-0 right-0 w-3 h-3 bg-blue-500 rounded-full"
                            style={{ pointerEvents: "none" }}
                        />
                    )}
                </AnimatePresence>
            </div>
        </Dropdown>
    );
};

export default NotificationDropdown;
