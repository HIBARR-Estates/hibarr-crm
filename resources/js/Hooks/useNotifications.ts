import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery, useApiMutate } from "@/lib/api/client";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
import {
    Notification,
    NotificationFilters,
    NotificationUnreadSummaryResponse,
    NotificationsListResponse,
    NotificationTypesResponse,
    NotificationMarkReadResponse,
    NotificationDeleteResponse,
    NotificationTypeOption,
} from "@/Types/api/notification";
import {
    playNotificationSound,
    showDesktopNotification,
    seedIslandSeenNotifications,
    takeUnseenNotifications,
} from "@/lib/notificationAlerts";
import useNotificationIslandAlertsFlag from "@/Hooks/useNotificationIslandAlertsFlag";

const EMPTY_NOTIFICATIONS: Notification[] = [];

/** First summary observation in this JS realm — seed without alerting. */
let hasSeededIslandSeenIds = false;

/**
 * Hook for fetching and polling unread notification summary.
 * Used primarily for the notification dropdown/bell icon.
 *
 * @param pollingInterval - Interval in ms to poll for new notifications (default: 30s)
 * @param enabled - Whether to enable the query
 */
export const useNotificationSummary = (
    pollingInterval: number = 30000,
    enabled: boolean = true,
    onNewNotifications?: (notifications: Notification[]) => void
) => {
    const queryClient = useQueryClient();
    const islandAlertsEnabled = useNotificationIslandAlertsFlag();

    const {
        data: response,
        isLoading,
        isRefetching,
        error,
        refetch,
    } = useApiQuery<NotificationUnreadSummaryResponse>({
        path: route("notifications.api.unread_summary"),
        // Uses react-query's own interval scheduling (rather than a manual
        // setInterval) so multiple mounted consumers of this hook (bell
        // dropdown + notch bridge) share one polling cadence per query key
        // instead of each running an independent timer against the API.
        options: { enabled, refetchInterval: enabled ? pollingInterval : false },
    });

    const unreadCount = response?.data?.unread_count ?? 0;
    const notifications = response?.data?.notifications ?? EMPTY_NOTIFICATIONS;

    // Sound + desktop popup (and any extra subscriber, e.g. the notch) for
    // notifications that weren't alerted yet this session. First successful
    // load only seeds seen IDs. Accumulated session-scoped IDs prevent an
    // island from showing again for the same notification; multiple hook
    // consumers share one takeUnseenNotifications pass so alerts fire once.
    useEffect(() => {
        if (!enabled || isLoading) return;

        if (!hasSeededIslandSeenIds) {
            seedIslandSeenNotifications(notifications);
            hasSeededIslandSeenIds = true;
            return;
        }

        const newOnes = takeUnseenNotifications(notifications);
        if (newOnes.length === 0) return;

        if (islandAlertsEnabled) {
            playNotificationSound();
            newOnes.slice(0, 3).forEach((n) => {
                showDesktopNotification(n.title, n.text, n.link);
            });
        }
        onNewNotifications?.(newOnes);
    }, [
        notifications,
        enabled,
        isLoading,
        islandAlertsEnabled,
        onNewNotifications,
    ]);

    // Invalidate cache to force refresh
    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({
            queryKey: [route("notifications.api.unread_summary")],
        });
    }, [queryClient]);

    return {
        unreadCount,
        notifications,
        isLoading,
        isRefetching,
        error,
        refetch,
        invalidate,
    };
};

/**
 * Hook for fetching paginated notifications list with filters.
 * Used for the full notifications page.
 *
 * @param filters - Notification filters
 * @param enabled - Whether to enable the query
 */
export const useNotificationsList = (
    filters: NotificationFilters = {},
    enabled: boolean = true
) => {
    const queryClient = useQueryClient();

    // Build query params from filters
    const params = useMemo(() => {
        const p: Record<string, string | number> = {};
        if (filters.status && filters.status !== "all")
            p.status = filters.status;
        if (filters.type) p.type = filters.type;
        if (filters.search) p.search = filters.search;
        if (filters.page) p.page = filters.page;
        if (filters.per_page) p.per_page = filters.per_page;
        return p;
    }, [filters]);

    const {
        data: response,
        isLoading,
        isRefetching,
        error,
        refetch,
    } = useApiQuery<NotificationsListResponse>({
        path: route("notifications.api.index"),
        params,
        options: { enabled },
    });

    const notifications = response?.data?.notifications ?? EMPTY_NOTIFICATIONS;
    const pagination = response?.data?.pagination ?? {
        current_page: 1,
        last_page: 1,
        per_page: 15,
        total: 0,
        from: null,
        to: null,
    };

    // Invalidate cache to force refresh
    const invalidate = useCallback(() => {
        queryClient.invalidateQueries({
            queryKey: [route("notifications.api.index")],
        });
    }, [queryClient]);

    return {
        notifications,
        pagination,
        isLoading,
        isRefetching,
        error,
        refetch,
        invalidate,
    };
};

/**
 * Hook for fetching notification types for filter dropdown.
 */
export const useNotificationTypes = () => {
    const {
        data: response,
        isLoading,
        error,
    } = useApiQuery<NotificationTypesResponse>({
        path: route("notifications.api.types"),
    });

    const types: NotificationTypeOption[] = response?.data ?? [];

    return { types, isLoading, error };
};

/**
 * Hook for notification mutations (mark read, delete, etc.).
 * Handles automatic cache invalidation on success.
 */
export const useNotificationMutations = () => {
    const queryClient = useQueryClient();

    // Helper to invalidate all notification-related queries
    const invalidateNotifications = useCallback(() => {
        queryClient.invalidateQueries({
            queryKey: [route("notifications.api.index")],
        });
        queryClient.invalidateQueries({
            queryKey: [route("notifications.api.unread_summary")],
        });
    }, [queryClient]);

    // Mark single notification as read
    const markReadMutation = useApiMutate<
        { id: string },
        NotificationMarkReadResponse["data"],
        ApiResponse<NotificationMarkReadResponse["data"]>
    >(route("notifications.api.mark_read"), "POST", () => {
        invalidateNotifications();
    });

    /** Same endpoint, but patches the unread summary cache instead of invalidating (no refetch storm). */
    const markReadQuietMutation = useApiMutate<
        { id: string },
        NotificationMarkReadResponse["data"],
        ApiResponse<NotificationMarkReadResponse["data"]>
    >(route("notifications.api.mark_read"), "POST");

    const patchUnreadSummaryAfterMark = useCallback(
        (notificationId: string, unreadCount?: number) => {
            const summaryKey = [route("notifications.api.unread_summary")];
            queryClient.setQueryData<NotificationUnreadSummaryResponse>(
                summaryKey,
                (old) => {
                    if (!old?.data) return old;
                    const notifications = old.data.notifications.filter(
                        (n) => n.id !== notificationId,
                    );
                    return {
                        ...old,
                        data: {
                            ...old.data,
                            unread_count:
                                unreadCount ??
                                Math.max(0, old.data.unread_count - 1),
                            notifications,
                        },
                    };
                },
            );
        },
        [queryClient],
    );

    const markAsReadQuiet = useCallback(
        (id: string) => {
            markReadQuietMutation.mutate(
                { id },
                {
                    suppressSuccessToast: true,
                    onSuccess: (response) => {
                        if (!isSuccessResponse(response)) return;
                        patchUnreadSummaryAfterMark(
                            id,
                            response.data?.unread_count,
                        );
                    },
                },
            );
        },
        [markReadQuietMutation, patchUnreadSummaryAfterMark],
    );

    // Mark multiple notifications as read
    const markMultipleReadMutation = useApiMutate<
        { ids: string[] },
        NotificationMarkReadResponse["data"],
        ApiResponse<NotificationMarkReadResponse["data"]>
    >(route("notifications.api.mark_multiple_read"), "POST", () => {
        invalidateNotifications();
    });

    // Mark all notifications as read
    const markAllReadMutation = useApiMutate<
        {},
        NotificationMarkReadResponse["data"],
        ApiResponse<NotificationMarkReadResponse["data"]>
    >(route("notifications.api.mark_all_read"), "POST", () => {
        invalidateNotifications();
    });

    // Delete single notification
    const deleteMutation = useApiMutate<
        { id: string },
        NotificationDeleteResponse["data"],
        ApiResponse<NotificationDeleteResponse["data"]>
    >(route("notifications.api.delete"), "POST", () => {
        invalidateNotifications();
    });

    // Delete multiple notifications
    const deleteMultipleMutation = useApiMutate<
        { ids: string[] },
        NotificationDeleteResponse["data"],
        ApiResponse<NotificationDeleteResponse["data"]>
    >(route("notifications.api.delete_multiple"), "POST", () => {
        invalidateNotifications();
    });

    // Delete all read notifications
    const deleteAllReadMutation = useApiMutate<
        {},
        NotificationDeleteResponse["data"],
        ApiResponse<NotificationDeleteResponse["data"]>
    >(route("notifications.api.delete_all_read"), "POST", () => {
        invalidateNotifications();
    });

    return {
        // Mark read
        markAsRead: markReadMutation.mutate,
        markAsReadQuiet,
        markMultipleAsRead: markMultipleReadMutation.mutate,
        markAllAsRead: markAllReadMutation.mutate,
        isMarkingRead:
            markReadMutation.isPending ||
            markMultipleReadMutation.isPending ||
            markAllReadMutation.isPending,

        // Delete
        deleteNotification: deleteMutation.mutate,
        deleteMultiple: deleteMultipleMutation.mutate,
        deleteAllRead: deleteAllReadMutation.mutate,
        isDeleting:
            deleteMutation.isPending ||
            deleteMultipleMutation.isPending ||
            deleteAllReadMutation.isPending,

        // General
        isLoading:
            markReadMutation.isPending ||
            markMultipleReadMutation.isPending ||
            markAllReadMutation.isPending ||
            deleteMutation.isPending ||
            deleteMultipleMutation.isPending ||
            deleteAllReadMutation.isPending,

        // Cache invalidation
        invalidate: invalidateNotifications,
    };
};

/**
 * Combined hook for notification management with selection state.
 * Provides all functionality needed for the notifications page.
 */
export const useNotifications = (initialFilters: NotificationFilters = {}) => {
    const [filters, setFilters] = useState<NotificationFilters>({
        status: "all",
        page: 1,
        per_page: 15,
        ...initialFilters,
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Fetch notifications
    const {
        notifications,
        pagination,
        isLoading: isListLoading,
        isRefetching: isListRefetching,
        refetch: refetchList,
        invalidate: invalidateList,
    } = useNotificationsList(filters);

    // Fetch types for filter
    const { types, isLoading: isTypesLoading } = useNotificationTypes();

    // Mutations
    const {
        markAsRead,
        markMultipleAsRead,
        markAllAsRead,
        deleteNotification,
        deleteMultiple,
        deleteAllRead,
        isLoading: isMutating,
        invalidate: invalidateMutations,
    } = useNotificationMutations();

    // Selection handlers
    const selectNotification = useCallback((id: string, selected: boolean) => {
        setSelectedIds((prev) =>
            selected ? [...prev, id] : prev.filter((i) => i !== id)
        );
    }, []);

    const selectAll = useCallback(
        (selected: boolean) => {
            setSelectedIds(selected ? notifications.map((n) => n.id) : []);
        },
        [notifications]
    );

    const clearSelection = useCallback(() => {
        setSelectedIds([]);
    }, []);

    // Update filters
    const updateFilters = useCallback(
        (newFilters: Partial<NotificationFilters>) => {
            setFilters((prev) => ({
                ...prev,
                ...newFilters,
                // Reset page when filters change (except page itself)
                page: newFilters.page ?? 1,
            }));
            clearSelection();
        },
        [clearSelection]
    );

    // Page change handler
    const goToPage = useCallback(
        (page: number) => {
            setFilters((prev) => ({ ...prev, page }));
            clearSelection();
        },
        [clearSelection]
    );

    // Bulk action handlers
    const handleBulkMarkRead = useCallback(() => {
        if (selectedIds.length === 0) return;
        markMultipleAsRead({ ids: selectedIds });
        clearSelection();
    }, [selectedIds, markMultipleAsRead, clearSelection]);

    const handleBulkDelete = useCallback(() => {
        if (selectedIds.length === 0) return;
        deleteMultiple({ ids: selectedIds });
        clearSelection();
    }, [selectedIds, deleteMultiple, clearSelection]);

    // Check if all on current page are selected
    const allSelected = useMemo(() => {
        return (
            notifications.length > 0 &&
            notifications.every((n) => selectedIds.includes(n.id))
        );
    }, [notifications, selectedIds]);

    // Check if some (but not all) are selected
    const someSelected = useMemo(() => {
        return (
            selectedIds.length > 0 &&
            notifications.some((n) => selectedIds.includes(n.id)) &&
            !allSelected
        );
    }, [notifications, selectedIds, allSelected]);

    return {
        // Data
        notifications,
        pagination,
        types,
        filters,
        selectedIds,

        // Loading states
        isLoading: isListLoading || isTypesLoading,
        isRefetching: isListRefetching,
        isMutating,

        // Selection state
        allSelected,
        someSelected,
        selectedCount: selectedIds.length,

        // Filter handlers
        updateFilters,
        goToPage,

        // Selection handlers
        selectNotification,
        selectAll,
        clearSelection,

        // Single item actions
        markAsRead: (id: string) => markAsRead({ id }),
        deleteNotification: (id: string) => deleteNotification({ id }),

        // Bulk actions
        markMultipleAsRead: handleBulkMarkRead,
        deleteMultiple: handleBulkDelete,
        markAllAsRead: () => markAllAsRead({}),
        deleteAllRead: () => deleteAllRead({}),

        // Refresh
        refetch: refetchList,
        invalidate: () => {
            invalidateList();
            invalidateMutations();
        },
    };
};
