import React, { useState, useCallback } from "react";
import {
    Badge,
    Dropdown,
    Button,
    List,
    Typography,
    Skeleton,
    Empty,
    Space,
    Tooltip,
    Divider,
    App,
} from "antd";
import {
    BellOutlined,
    CheckOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    MessageOutlined,
    FileTextOutlined,
    TeamOutlined,
    DollarOutlined,
    CalendarOutlined,
    UserOutlined,
    ProjectOutlined,
    SettingOutlined,
    ExclamationCircleOutlined,
    GiftOutlined,
    FileProtectOutlined,
    CommentOutlined,
    ScheduleOutlined,
    RiseOutlined,
    RightOutlined,
} from "@ant-design/icons";
import { router } from "@inertiajs/react";
import { motion, AnimatePresence } from "framer-motion";
import {
    useNotificationSummary,
    useNotificationMutations,
} from "@/Hooks/useNotifications";
import { Notification, NotificationIcon } from "@/Types/api/notification";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

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
        bell: <BellOutlined style={{ color: "#8c8c8c" }} />,
    };

    return iconMap[icon] || iconMap.bell;
};

/**
 * Single notification item in the dropdown
 */
interface NotificationItemProps {
    notification: Notification;
    onMarkRead: (id: string) => void;
    onClick: (notification: Notification) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
    notification,
    onMarkRead,
    onClick,
}) => {
    const handleClick = useCallback(() => {
        if (!notification.is_read) {
            onMarkRead(notification.id);
        }
        onClick(notification);
    }, [notification, onMarkRead, onClick]);

    const handleMarkRead = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onMarkRead(notification.id);
        },
        [notification.id, onMarkRead],
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
        >
            <List.Item
                onClick={handleClick}
                className={`cursor-pointer transition-all hover:bg-gray-50 ${
                    !notification.is_read ? "bg-blue-50/50" : ""
                }`}
                style={{ padding: "12px 16px" }}
            >
                <List.Item.Meta
                    avatar={
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                !notification.is_read
                                    ? "bg-blue-100"
                                    : "bg-gray-100"
                            }`}
                        >
                            {getNotificationIcon(notification.icon)}
                        </div>
                    }
                    title={
                        <div className="flex items-center justify-between">
                            <Text
                                strong={!notification.is_read}
                                className="text-sm truncate max-w-[180px]"
                            >
                                {notification.title}
                            </Text>
                            {!notification.is_read && (
                                <Tooltip title="Mark as read">
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<CheckOutlined />}
                                        onClick={handleMarkRead}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    />
                                </Tooltip>
                            )}
                        </div>
                    }
                    description={
                        <div className="space-y-1">
                            <Paragraph
                                ellipsis={{ rows: 2 }}
                                className="!mb-0 text-xs text-gray-500"
                            >
                                {notification.text}
                            </Paragraph>
                            <div className="flex items-center gap-1">
                                <ClockCircleOutlined className="text-gray-400 text-xs" />
                                <Text className="text-xs text-gray-400">
                                    {notification.time_ago}
                                </Text>
                            </div>
                        </div>
                    }
                />
                {!notification.is_read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 ml-2 flex-shrink-0" />
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
 */
const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
    className = "",
    pollingInterval = 30000,
}) => {
    const [open, setOpen] = useState(false);
    const { message } = App.useApp();

    const { notifications, unreadCount, isLoading, refetch } =
        useNotificationSummary(pollingInterval);

    const { markAsRead, markAllAsRead, isMarkingRead } =
        useNotificationMutations();

    // Handle notification click
    const handleNotificationClick = useCallback(
        (notification: Notification) => {
            setOpen(false);
            if (notification.link) {
                // Use standard navigation to support both Inertia and non-Inertia pages
                window.location.href = notification.link;
            }
        },
        [],
    );

    // Handle mark as read
    const handleMarkRead = useCallback(
        (id: string) => {
            markAsRead({ id });
        },
        [markAsRead],
    );

    // Handle mark all as read
    const handleMarkAllRead = useCallback(() => {
        markAllAsRead({});
    }, [markAllAsRead]);

    // Handle view all click
    const handleViewAll = useCallback(() => {
        setOpen(false);
        // Use standard navigation to support both Inertia and non-Inertia pages
        window.location.href = route("notifications.index");
    }, []);

    // Dropdown content
    const dropdownContent = (
        <div
            className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
            style={{ width: 380, maxHeight: "80vh" }}
        >
            {/* Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BellOutlined className="text-lg" />
                    <Text strong>Notifications</Text>
                    {unreadCount > 0 && (
                        <Badge
                            count={unreadCount}
                            className="ml-1"
                            style={{ backgroundColor: "#1890ff" }}
                        />
                    )}
                </div>
                {unreadCount > 0 && (
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
                                onMarkRead={handleMarkRead}
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
            dropdownRender={() => dropdownContent}
            trigger={["click"]}
            open={open}
            onOpenChange={setOpen}
            placement="bottomRight"
        >
            <div className={`cursor-pointer relative ${className}`}>
                <Badge
                    count={unreadCount}
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
                                        unreadCount > 0
                                            ? "text-blue-500"
                                            : "text-gray-500"
                                    }`}
                                />
                            }
                            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100"
                        />
                    </motion.div>
                </Badge>
                {/* Pulse animation for new notifications */}
                <AnimatePresence>
                    {unreadCount > 0 && (
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
