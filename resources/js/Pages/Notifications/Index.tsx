import React, { useCallback, useState } from "react";
import {
    Card,
    List,
    Typography,
    Button,
    Checkbox,
    Select,
    Input,
    Space,
    Empty,
    Skeleton,
    Pagination,
    Dropdown,
    Modal,
    Tag,
    Tooltip,
    Alert,
    Divider,
    App,
    MenuProps,
} from "antd";
import {
    BellOutlined,
    CheckOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    DeleteOutlined,
    FilterOutlined,
    SearchOutlined,
    MoreOutlined,
    ExclamationCircleOutlined,
    InboxOutlined,
    ReloadOutlined,
    ClearOutlined,
    MessageOutlined,
    FileTextOutlined,
    TeamOutlined,
    DollarOutlined,
    CalendarOutlined,
    UserOutlined,
    ProjectOutlined,
    GiftOutlined,
    FileProtectOutlined,
    CommentOutlined,
    ScheduleOutlined,
    RiseOutlined,
} from "@ant-design/icons";
import { Head, router } from "@inertiajs/react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useNotifications } from "@/Hooks/useNotifications";
import {
    Notification,
    NotificationIcon,
    NotificationFilterStatus,
} from "@/Types/api/notification";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const { Text, Paragraph, Title } = Typography;
const { Search } = Input;

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
 * Get icon background color based on notification type
 */
const getIconBackground = (icon: NotificationIcon, isRead: boolean): string => {
    if (isRead) return "bg-gray-100";

    const bgMap: Record<NotificationIcon, string> = {
        task: "bg-blue-100",
        "task-completed": "bg-green-100",
        comment: "bg-purple-100",
        notice: "bg-orange-100",
        chat: "bg-cyan-100",
        ticket: "bg-red-100",
        lead: "bg-blue-100",
        deal: "bg-green-100",
        project: "bg-purple-100",
        expense: "bg-orange-100",
        invoice: "bg-green-100",
        leave: "bg-blue-100",
        "leave-approved": "bg-green-100",
        "leave-rejected": "bg-red-100",
        event: "bg-purple-100",
        appreciation: "bg-pink-100",
        birthday: "bg-orange-100",
        contract: "bg-blue-100",
        discussion: "bg-cyan-100",
        shift: "bg-orange-100",
        promotion: "bg-green-100",
        bell: "bg-gray-100",
    };

    return bgMap[icon] || "bg-gray-100";
};

/**
 * Single notification item with selection support
 */
interface NotificationItemProps {
    notification: Notification;
    selected: boolean;
    showCheckbox: boolean;
    onSelect: (id: string, selected: boolean) => void;
    onMarkRead: (id: string) => void;
    onDelete: (id: string) => void;
    onClick: (notification: Notification) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
    notification,
    selected,
    showCheckbox,
    onSelect,
    onMarkRead,
    onDelete,
    onClick,
}) => {
    const [showActions, setShowActions] = useState(false);

    const handleClick = useCallback(() => {
        onClick(notification);
    }, [notification, onClick]);

    const handleCheckboxChange = useCallback(
        (e: any) => {
            e.stopPropagation();
            onSelect(notification.id, e.target.checked);
        },
        [notification.id, onSelect]
    );

    const handleMarkRead = useCallback(
        (e?: React.MouseEvent) => {
            e?.stopPropagation();
            onMarkRead(notification.id);
        },
        [notification.id, onMarkRead]
    );

    const handleDelete = useCallback(
        (e?: React.MouseEvent) => {
            e?.stopPropagation();
            onDelete(notification.id);
        },
        [notification.id, onDelete]
    );

    const actionItems: MenuProps["items"] = [
        ...(notification.is_read
            ? []
            : [
                  {
                      key: "mark-read",
                      label: "Mark as read",
                      icon: <CheckOutlined />,
                      onClick: () => handleMarkRead(),
                  },
              ]),
        {
            key: "delete",
            label: "Delete",
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => handleDelete(),
        },
    ];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            <div
                onClick={handleClick}
                className={`flex items-start gap-4 p-4 cursor-pointer transition-all border-b border-gray-100 hover:bg-gray-50 ${
                    !notification.is_read ? "bg-blue-50/30" : ""
                } ${selected ? "bg-blue-100/50" : ""}`}
            >
                {/* Checkbox */}
                {showCheckbox && (
                    <div className="flex-shrink-0 pt-1">
                        <Checkbox
                            checked={selected}
                            onChange={handleCheckboxChange}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}

                {/* Icon */}
                <div
                    className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${getIconBackground(
                        notification.icon,
                        notification.is_read
                    )}`}
                >
                    <span className="text-lg">
                        {getNotificationIcon(notification.icon)}
                    </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <Text
                                    strong={!notification.is_read}
                                    className="text-sm"
                                >
                                    {notification.title}
                                </Text>
                                {!notification.is_read && (
                                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                )}
                            </div>
                            <Paragraph
                                ellipsis={{ rows: 2 }}
                                className="!mb-1 text-sm text-gray-600"
                            >
                                {notification.text}
                            </Paragraph>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <ClockCircleOutlined />
                                <span>{notification.time_ago}</span>
                                <span>•</span>
                                <Tag
                                    color={
                                        notification.is_read
                                            ? "default"
                                            : "blue"
                                    }
                                    className="text-xs"
                                >
                                    {notification.type_slug.replace(/_/g, " ")}
                                </Tag>
                            </div>
                        </div>

                        {/* Actions */}
                        <AnimatePresence>
                            {showActions && (
                                <motion.div
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className="flex items-center gap-1"
                                >
                                    {!notification.is_read && (
                                        <Tooltip title="Mark as read">
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<CheckOutlined />}
                                                onClick={handleMarkRead}
                                            />
                                        </Tooltip>
                                    )}
                                    <Dropdown
                                        menu={{ items: actionItems }}
                                        trigger={["click"]}
                                    >
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<MoreOutlined />}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </Dropdown>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

/**
 * Bulk actions toolbar
 */
interface BulkActionsBarProps {
    selectedCount: number;
    totalCount: number;
    allSelected: boolean;
    someSelected: boolean;
    onSelectAll: (selected: boolean) => void;
    onMarkRead: () => void;
    onDelete: () => void;
    onClearSelection: () => void;
    loading?: boolean;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount,
    totalCount,
    allSelected,
    someSelected,
    onSelectAll,
    onMarkRead,
    onDelete,
    onClearSelection,
    loading,
}) => {
    const { modal } = App.useApp();

    const handleDelete = () => {
        modal.confirm({
            title: "Delete Notifications",
            icon: <ExclamationCircleOutlined />,
            content: `Are you sure you want to delete ${selectedCount} notification(s)? This action cannot be undone.`,
            okText: "Delete",
            okButtonProps: { danger: true },
            onOk: onDelete,
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-blue-50 border-b border-blue-100"
        >
            <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={(e) => onSelectAll(e.target.checked)}
                    >
                        <Text className="text-sm">
                            {selectedCount > 0
                                ? `${selectedCount} selected`
                                : `Select all (${totalCount})`}
                        </Text>
                    </Checkbox>
                </div>

                {selectedCount > 0 && (
                    <Space>
                        <Button
                            size="small"
                            icon={<CheckOutlined />}
                            onClick={onMarkRead}
                            loading={loading}
                        >
                            Mark as read
                        </Button>
                        <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={handleDelete}
                            loading={loading}
                        >
                            Delete
                        </Button>
                        <Button
                            size="small"
                            type="text"
                            icon={<ClearOutlined />}
                            onClick={onClearSelection}
                        >
                            Clear
                        </Button>
                    </Space>
                )}
            </div>
        </motion.div>
    );
};

/**
 * Filters bar component
 */
interface FiltersBarProps {
    status: NotificationFilterStatus;
    typeFilter: string;
    searchQuery: string;
    types: { value: string; label: string }[];
    onStatusChange: (status: NotificationFilterStatus) => void;
    onTypeChange: (type: string) => void;
    onSearchChange: (search: string) => void;
    onMarkAllRead: () => void;
    onDeleteAllRead: () => void;
    onRefresh: () => void;
    loading?: boolean;
    hasUnread?: boolean;
    hasRead?: boolean;
}

const FiltersBar: React.FC<FiltersBarProps> = ({
    status,
    typeFilter,
    searchQuery,
    types,
    onStatusChange,
    onTypeChange,
    onSearchChange,
    onMarkAllRead,
    onDeleteAllRead,
    onRefresh,
    loading,
    hasUnread,
    hasRead,
}) => {
    const { modal } = App.useApp();

    const handleDeleteAllRead = () => {
        modal.confirm({
            title: "Delete Read Notifications",
            icon: <ExclamationCircleOutlined />,
            content:
                "Are you sure you want to delete all read notifications? This action cannot be undone.",
            okText: "Delete",
            okButtonProps: { danger: true },
            onOk: onDeleteAllRead,
        });
    };

    const moreActions = [
        ...(hasUnread
            ? [
                  {
                      key: "mark-all-read",
                      label: "Mark all as read",
                      icon: <CheckCircleOutlined />,
                      onClick: onMarkAllRead,
                  },
              ]
            : []),
        ...(hasRead
            ? [
                  {
                      key: "delete-all-read",
                      label: "Delete all read",
                      icon: <DeleteOutlined />,
                      danger: true,
                      onClick: handleDeleteAllRead,
                  },
              ]
            : []),
    ];

    return (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Status filter */}
                <div className="flex items-center gap-4">
                    <Select
                        value={status}
                        onChange={onStatusChange}
                        style={{ width: 140 }}
                        options={[
                            { value: "all", label: "All notifications" },
                            { value: "unread", label: "Unread" },
                            { value: "read", label: "Read" },
                        ]}
                    />

                    <Select
                        value={typeFilter || undefined}
                        onChange={onTypeChange}
                        placeholder="Filter by type"
                        allowClear
                        style={{ width: 180 }}
                        options={types}
                        suffixIcon={<FilterOutlined />}
                    />

                    <Search
                        placeholder="Search notifications..."
                        allowClear
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        style={{ width: 250 }}
                        prefix={<SearchOutlined className="text-gray-400" />}
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <Tooltip title="Refresh">
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={onRefresh}
                            loading={loading}
                        />
                    </Tooltip>

                    {moreActions.length > 0 && (
                        <Dropdown
                            menu={{ items: moreActions }}
                            trigger={["click"]}
                        >
                            <Button icon={<MoreOutlined />}>Actions</Button>
                        </Dropdown>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Main Notifications Page Component
 */
const NotificationsPage: React.FC = () => {
    const {
        notifications,
        pagination,
        types,
        filters,
        selectedIds,
        isLoading,
        isRefetching,
        isMutating,
        allSelected,
        someSelected,
        selectedCount,
        updateFilters,
        goToPage,
        selectNotification,
        selectAll,
        clearSelection,
        markAsRead,
        deleteNotification,
        markMultipleAsRead,
        deleteMultiple,
        markAllAsRead,
        deleteAllRead,
        refetch,
    } = useNotifications();

    const [showCheckboxes, setShowCheckboxes] = useState(false);

    // Handle notification click
    const handleNotificationClick = useCallback(
        (notification: Notification) => {
            if (!notification.is_read) {
                markAsRead(notification.id);
            }
            if (notification.link) {
                router.visit(notification.link);
            }
        },
        [markAsRead]
    );

    // Handle search with debounce
    const handleSearchChange = useCallback(
        (search: string) => {
            updateFilters({ search });
        },
        [updateFilters]
    );

    // Check if there are unread/read notifications
    const hasUnread = notifications.some((n) => !n.is_read);
    const hasRead = notifications.some((n) => n.is_read);

    // Toggle selection mode
    const toggleSelectionMode = useCallback(() => {
        setShowCheckboxes((prev) => !prev);
        if (showCheckboxes) {
            clearSelection();
        }
    }, [showCheckboxes, clearSelection]);

    const breadcrumbs = [
        { name: "Dashboard", href: route("dashboard") },
        { name: "Notifications" },
    ];

    return (
        <DashboardLayout>
            <Head title="Notifications" />
            <PageLayout title="Notifications" breadcrumbs={breadcrumbs}>
                <div className="max-w-7xl mx-auto space-y-6">
                    <Card
                        bodyStyle={{ padding: 0 }}
                        title={
                            <div className="flex items-center gap-3">
                                <BellOutlined className="text-xl" />
                                <span>Notifications</span>
                                {pagination.total > 0 && (
                                    <Tag>{pagination.total} total</Tag>
                                )}
                            </div>
                        }
                        extra={
                            <Button
                                type={showCheckboxes ? "primary" : "default"}
                                onClick={toggleSelectionMode}
                            >
                                {showCheckboxes ? "Done" : "Select"}
                            </Button>
                        }
                    >
                        {/* Filters */}
                        <FiltersBar
                            status={filters.status || "all"}
                            typeFilter={filters.type || ""}
                            searchQuery={filters.search || ""}
                            types={types}
                            onStatusChange={(status) =>
                                updateFilters({ status })
                            }
                            onTypeChange={(type) => updateFilters({ type })}
                            onSearchChange={handleSearchChange}
                            onMarkAllRead={markAllAsRead}
                            onDeleteAllRead={deleteAllRead}
                            onRefresh={refetch}
                            loading={isRefetching || isMutating}
                            hasUnread={hasUnread}
                            hasRead={hasRead}
                        />

                        {/* Bulk actions bar */}
                        <AnimatePresence>
                            {showCheckboxes && (
                                <BulkActionsBar
                                    selectedCount={selectedCount}
                                    totalCount={notifications.length}
                                    allSelected={allSelected}
                                    someSelected={someSelected}
                                    onSelectAll={selectAll}
                                    onMarkRead={markMultipleAsRead}
                                    onDelete={deleteMultiple}
                                    onClearSelection={clearSelection}
                                    loading={isMutating}
                                />
                            )}
                        </AnimatePresence>

                        {/* Notification list */}
                        <div className="min-h-[400px]">
                            {isLoading ? (
                                <div className="p-4 space-y-4">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <Skeleton
                                            key={i}
                                            active
                                            avatar
                                            paragraph={{ rows: 2 }}
                                        />
                                    ))}
                                </div>
                            ) : notifications.length > 0 ? (
                                <AnimatePresence mode="popLayout">
                                    {notifications.map((notification) => (
                                        <NotificationItem
                                            key={notification.id}
                                            notification={notification}
                                            selected={selectedIds.includes(
                                                notification.id
                                            )}
                                            showCheckbox={showCheckboxes}
                                            onSelect={selectNotification}
                                            onMarkRead={markAsRead}
                                            onDelete={deleteNotification}
                                            onClick={handleNotificationClick}
                                        />
                                    ))}
                                </AnimatePresence>
                            ) : (
                                <div className="py-16">
                                    <Empty
                                        image={
                                            <InboxOutlined
                                                style={{
                                                    fontSize: 64,
                                                    color: "#d9d9d9",
                                                }}
                                            />
                                        }
                                        description={
                                            <div className="space-y-2">
                                                <Text className="text-gray-500 text-lg">
                                                    No notifications found
                                                </Text>
                                                <Paragraph className="text-gray-400">
                                                    {filters.status === "unread"
                                                        ? "You're all caught up! No unread notifications."
                                                        : filters.search
                                                        ? "Try adjusting your search or filters."
                                                        : "When you receive notifications, they'll appear here."}
                                                </Paragraph>
                                            </div>
                                        }
                                    />
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        {pagination.total > 0 && (
                            <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                                <Text className="text-sm text-gray-500">
                                    Showing {pagination.from}-{pagination.to} of{" "}
                                    {pagination.total}
                                </Text>
                                <Pagination
                                    current={pagination.current_page}
                                    total={pagination.total}
                                    pageSize={pagination.per_page}
                                    onChange={goToPage}
                                    showSizeChanger={false}
                                    size="small"
                                />
                            </div>
                        )}
                    </Card>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default NotificationsPage;
