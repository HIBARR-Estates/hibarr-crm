<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Property;
use App\Models\PropertyCollaborator;
use App\Services\PropertyAuthorizationService;
use App\Services\PropertyCollaboratorService;
use Illuminate\Http\Request;

class PropertyCollaboratorController extends AccountBaseController
{
    public function __construct(
        private PropertyCollaboratorService $collaboratorService,
        private PropertyAuthorizationService $authorizationService,
    ) {
        parent::__construct();
    }

    public function index(int $propertyId)
    {
        $property = Property::with([
            'collaborators:id,name,email,image',
            'responsibleAgent:id,name,email,image',
        ])->findOrFail($propertyId);

        abort_403(!$this->authorizationService->canViewProperty(user(), $property));

        $collaborators = PropertyCollaborator::query()
            ->active()
            ->where('property_id', $property->id)
            ->with('user:id,name,email,image')
            ->get();

        return Reply::successWithData('', [
            'data' => [
                'collaborators' => $collaborators,
                'responsible_agent' => $property->responsibleAgent,
            ],
        ]);
    }

    public function destroy(int $propertyId, int $userId)
    {
        $property = Property::findOrFail($propertyId);

        abort_403(!$this->authorizationService->canManageTeam(user(), $property));

        if ($property->added_by === $userId) {
            return Reply::error(__('messages.cannotRemovePropertyCreator'));
        }

        $revoked = $this->collaboratorService->revoke($property, $userId, user());

        if (!$revoked) {
            return Reply::error(__('messages.collaboratorNotFound'));
        }

        return Reply::success(__('messages.collaboratorRemoved'));
    }
}
