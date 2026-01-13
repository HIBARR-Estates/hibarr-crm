<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class NotificationController extends AccountBaseController
{
    protected NotificationService $notificationService;

    public function __construct()
    {
        parent::__construct();
        $this->notificationService = new NotificationService();
    }

    /**
     * Display notifications page (Inertia view).
     */
    public function index()
    {
        $this->pageTitle = __('app.newNotifications');
        
        return Inertia::render('Notifications/Index', [
            'pageTitle' => $this->pageTitle,
        ]);
    }

    /**
     * Legacy: Show notifications HTML (for backward compatibility).
     */
    public function showNotifications()
    {
        $this->userType = 'all';

        if (in_array('client', user_roles())) {
            $this->userType = 'client';
        }

        $view = view('notifications.user_notifications', $this->data)->render();
        return Reply::dataOnly(['status' => 'success', 'html' => $view]);
    }

    /**
     * Legacy: All notifications blade view (for backward compatibility).
     */
    public function all()
    {
        $this->pageTitle = __('app.newNotifications');
        $this->userType = 'all';

        if (in_array('client', user_roles())) {
            $this->userType = 'client';
        }

        return view('notifications.all_user_notifications', $this->data);
    }

    /**
     * API: Get paginated notifications list.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function apiIndex(Request $request)
    {
        $filters = [
            'status' => $request->get('status', 'all'),
            'type' => $request->get('type'),
            'search' => $request->get('search'),
        ];

        $perPage = (int) $request->get('per_page', 15);
        $notifications = $this->notificationService->getNotifications($this->user, $filters, $perPage);

        $formattedNotifications = $this->notificationService->formatNotifications($notifications->getCollection());

        return response()->json([
            'status' => 'success',
            'data' => [
                'notifications' => $formattedNotifications,
                'pagination' => [
                    'current_page' => $notifications->currentPage(),
                    'last_page' => $notifications->lastPage(),
                    'per_page' => $notifications->perPage(),
                    'total' => $notifications->total(),
                    'from' => $notifications->firstItem(),
                    'to' => $notifications->lastItem(),
                ],
            ],
        ]);
    }

    /**
     * API: Get unread notification count and recent notifications for dropdown.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function apiUnreadSummary(Request $request)
    {
        $limit = (int) $request->get('limit', 6);
        
        $unreadCount = $this->notificationService->getUnreadCount($this->user);
        $recentNotifications = $this->notificationService->getRecentUnread($this->user, $limit);
        $formattedNotifications = $this->notificationService->formatNotifications($recentNotifications);

        return response()->json([
            'status' => 'success',
            'data' => [
                'unread_count' => $unreadCount,
                'notifications' => $formattedNotifications,
            ],
        ]);
    }

    /**
     * API: Get available notification types for filtering.
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function apiTypes()
    {
        $types = $this->notificationService->getNotificationTypes($this->user);

        return response()->json([
            'status' => 'success',
            'data' => $types,
        ]);
    }

    /**
     * API: Mark a single notification as read.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function apiMarkRead(Request $request)
    {
        $request->validate([
            'id' => 'required|string',
        ]);

        $success = $this->notificationService->markAsRead($this->user, $request->id);

        if (!$success) {
            return response()->json([
                'status' => 'fail',
                'message' => __('messages.notificationNotFound'),
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => __('messages.notificationRead'),
            'data' => [
                'unread_count' => $this->notificationService->getUnreadCount($this->user),
            ],
        ]);
    }

    /**
     * API: Mark multiple notifications as read (bulk action).
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function apiMarkMultipleRead(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'string',
        ]);

        $count = $this->notificationService->markMultipleAsRead($this->user, $request->ids);

        return response()->json([
            'status' => 'success',
            'message' => trans_choice('messages.notificationsMarkedRead', $count, ['count' => $count]),
            'data' => [
                'marked_count' => $count,
                'unread_count' => $this->notificationService->getUnreadCount($this->user),
            ],
        ]);
    }

    /**
     * Legacy: Mark all notifications as read.
     */
    public function markAllRead()
    {
        $count = $this->notificationService->markAllAsRead($this->user);
        return Reply::success(__('messages.notificationRead'));
    }

    /**
     * API: Mark all notifications as read.
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function apiMarkAllRead()
    {
        $count = $this->notificationService->markAllAsRead($this->user);

        return response()->json([
            'status' => 'success',
            'message' => __('messages.notificationRead'),
            'data' => [
                'marked_count' => $count,
                'unread_count' => 0,
            ],
        ]);
    }

    /**
     * Legacy: Mark single notification as read.
     */
    public function markRead(Request $request)
    {
        $this->user->unreadNotifications->where('id', $request->id)->markAsRead();
        return Reply::dataOnly(['status' => 'success']);
    }

    /**
     * API: Delete a single notification.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function apiDelete(Request $request)
    {
        $request->validate([
            'id' => 'required|string',
        ]);

        $success = $this->notificationService->delete($this->user, $request->id);

        if (!$success) {
            return response()->json([
                'status' => 'fail',
                'message' => __('messages.notificationNotFound'),
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => __('messages.notificationDeleted'),
            'data' => [
                'unread_count' => $this->notificationService->getUnreadCount($this->user),
            ],
        ]);
    }

    /**
     * API: Delete multiple notifications (bulk action).
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function apiDeleteMultiple(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'string',
        ]);

        $count = $this->notificationService->deleteMultiple($this->user, $request->ids);

        return response()->json([
            'status' => 'success',
            'message' => trans_choice('messages.notificationsDeleted', $count, ['count' => $count]),
            'data' => [
                'deleted_count' => $count,
                'unread_count' => $this->notificationService->getUnreadCount($this->user),
            ],
        ]);
    }

    /**
     * API: Delete all read notifications.
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function apiDeleteAllRead()
    {
        $count = $this->notificationService->deleteAllRead($this->user);

        return response()->json([
            'status' => 'success',
            'message' => trans_choice('messages.notificationsDeleted', $count, ['count' => $count]),
            'data' => [
                'deleted_count' => $count,
                'unread_count' => $this->notificationService->getUnreadCount($this->user),
            ],
        ]);
    }
}
