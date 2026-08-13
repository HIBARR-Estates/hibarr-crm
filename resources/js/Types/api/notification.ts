/**
 * Notification Types
 *
 * TypeScript interfaces for the notification system.
 */

/**
 * Notification item as returned by the API
 */
export interface Notification {
    id: string;
    type: string;
    type_slug: string;
    title: string;
    text: string;
    data: Record<string, any>;
    link: string | null;
    icon: NotificationIcon;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    time_ago: string;
}

/**
 * Notification icon types
 */
export type NotificationIcon =
    | "task"
    | "task-completed"
    | "comment"
    | "notice"
    | "chat"
    | "ticket"
    | "lead"
    | "deal"
    | "project"
    | "expense"
    | "invoice"
    | "leave"
    | "leave-approved"
    | "leave-rejected"
    | "event"
    | "appreciation"
    | "birthday"
    | "contract"
    | "discussion"
    | "shift"
    | "promotion"
    | "reminder"
    | "bell";

/**
 * Notification filter status options
 */
export type NotificationFilterStatus = "all" | "unread" | "read";

/**
 * Notification type option for filtering
 */
export interface NotificationTypeOption {
    value: string;
    label: string;
}

/**
 * Pagination info from API
 */
export interface NotificationPagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

/**
 * API Response for notifications list
 */
export interface NotificationsListResponse {
    status: "success" | "fail";
    data: {
        notifications: Notification[];
        pagination: NotificationPagination;
    };
}

/**
 * API Response for unread summary (used in dropdown)
 */
export interface NotificationUnreadSummaryResponse {
    status: "success" | "fail";
    data: {
        unread_count: number;
        notifications: Notification[];
    };
}

/**
 * API Response for notification types
 */
export interface NotificationTypesResponse {
    status: "success" | "fail";
    data: NotificationTypeOption[];
}

/**
 * API Response for mark read operations
 */
export interface NotificationMarkReadResponse {
    status: "success" | "fail";
    message: string;
    data: {
        marked_count?: number;
        unread_count: number;
    };
}

/**
 * API Response for delete operations
 */
export interface NotificationDeleteResponse {
    status: "success" | "fail";
    message: string;
    data: {
        deleted_count?: number;
        unread_count: number;
    };
}

/**
 * Filters for notification queries
 */
export interface NotificationFilters {
    status?: NotificationFilterStatus;
    type?: string;
    search?: string;
    page?: number;
    per_page?: number;
}

/**
 * Bulk action types
 */
export type NotificationBulkAction =
    | "mark_read"
    | "delete"
    | "mark_all_read"
    | "delete_all_read";

/**
 * Props for notification-related components
 */
export interface NotificationDropdownProps {
    className?: string;
}

export interface NotificationItemProps {
    notification: Notification;
    selected?: boolean;
    onSelect?: (id: string, selected: boolean) => void;
    onMarkRead?: (id: string) => void;
    onDelete?: (id: string) => void;
    onClick?: (notification: Notification) => void;
    showCheckbox?: boolean;
}

export interface NotificationListProps {
    notifications: Notification[];
    loading?: boolean;
    selectedIds?: string[];
    onSelect?: (id: string, selected: boolean) => void;
    onSelectAll?: (selected: boolean) => void;
    onMarkRead?: (id: string) => void;
    onDelete?: (id: string) => void;
    onClick?: (notification: Notification) => void;
    showCheckboxes?: boolean;
    emptyMessage?: string;
}

export interface NotificationFiltersProps {
    filters: NotificationFilters;
    onFiltersChange: (filters: NotificationFilters) => void;
    typeOptions: NotificationTypeOption[];
    loading?: boolean;
}

export interface NotificationBulkActionsProps {
    selectedCount: number;
    onMarkRead: () => void;
    onDelete: () => void;
    onClearSelection: () => void;
    loading?: boolean;
}
