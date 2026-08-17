<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Property;
use App\Models\PropertyWatcher;
use App\Services\PropertyAuthorizationService;
use App\Services\PropertyNotificationService;
use Illuminate\Http\Request;

class PropertyWatcherController extends AccountBaseController
{
    public function __construct(
        private PropertyAuthorizationService $authorizationService,
        private PropertyNotificationService $notificationService,
    ) {
        parent::__construct();
    }

    public function index(int $propertyId)
    {
        $property = Property::with([
            'watchers:id,name,email,image',
        ])->findOrFail($propertyId);

        abort_403(!$this->authorizationService->canViewProperty(user(), $property));

        return Reply::successWithData('', [
            'data' => $property->watchers,
        ]);
    }

    public function storeSelf(int $propertyId)
    {
        $property = Property::findOrFail($propertyId);
        $currentUser = user();

        abort_403(!$this->authorizationService->canAddSelfAsWatcher($currentUser, $property));

        $property->watchers()->syncWithoutDetaching([
            $currentUser->id => ['added_via' => PropertyWatcher::ADDED_VIA_SELF],
        ]);

        return Reply::successWithData(
            __('messages.watcherAdded'),
            ['data' => $property->fresh(['watchers:id,name,email,image'])->watchers]
        );
    }

    public function sync(Request $request, int $propertyId)
    {
        $property = Property::findOrFail($propertyId);

        abort_403(!$this->authorizationService->canManageTeam(user(), $property));

        $validated = $request->validate([
            'user_ids' => 'required|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        $oldWatcherIds = $property->watchers()->pluck('users.id')->toArray();

        $syncData = [];
        foreach ($validated['user_ids'] as $userId) {
            $syncData[$userId] = ['added_via' => PropertyWatcher::ADDED_VIA_MANUAL];
        }

        $property->watchers()->sync($syncData);

        $addedWatcherIds = array_diff($validated['user_ids'], $oldWatcherIds);
        if (! empty($addedWatcherIds)) {
            $this->notificationService->notifyWatcherAdded($property, $addedWatcherIds, user()?->id);
        }

        return Reply::successWithData(
            __('messages.watchersUpdated'),
            ['data' => $property->fresh(['watchers:id,name,email,image'])->watchers]
        );
    }

    public function destroy(int $propertyId, int $userId)
    {
        $property = Property::findOrFail($propertyId);
        $currentUser = user();

        $canManage = $this->authorizationService->canManageTeam($currentUser, $property);
        $isSelf = $currentUser->id === $userId;

        abort_403(!$canManage && !$isSelf);

        $property->watchers()->detach($userId);

        return Reply::success(__('messages.watcherRemoved'));
    }
}
