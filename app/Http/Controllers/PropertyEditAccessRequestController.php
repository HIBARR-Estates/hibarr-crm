<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Property;
use App\Models\PropertyEditAccessRequest;
use App\Models\User;
use App\Notifications\EditAccessRequested;
use App\Notifications\EditAccessReviewed;
use App\Services\PropertyCollaboratorService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PropertyEditAccessRequestController extends AccountBaseController
{
    public function __construct(
        private PropertyCollaboratorService $collaboratorService,
    ) {
        parent::__construct();
    }

    public function index(Request $request)
    {
        $this->authorize('viewAny', PropertyEditAccessRequest::class);

        $user = user();
        $query = PropertyEditAccessRequest::with([
            'property:id,title,reference_code,city,area,status,property_type,sale_type,display_title',
            'requestingAgent:id,name,email,image',
        ]);

        if (!$this->isPrivilegedUser($user)) {
            $query->forAgent($user->id);
        } else {
            $query->with('responsibleAgent:id,name,email,image');
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($propertyId = $request->input('property_id')) {
            $query->forProperty((int) $propertyId);
        }

        if ($direction = $request->input('direction')) {
            if ($direction === 'sent') {
                $query->where('requesting_agent_id', $user->id);
            } elseif ($direction === 'received') {
                $query->where('responsible_agent_id', $user->id);
            }
        }

        $requests = $query->orderByDesc('created_at')->paginate(20);

        if (!$this->isPrivilegedUser($user)) {
            $requests->getCollection()->transform(function ($req) use ($user) {
                if ($user->id !== $req->responsible_agent_id) {
                    $req->makeHidden(['responsible_agent_id']);
                    $req->unsetRelation('responsibleAgent');
                }

                return $req;
            });
        }

        if ($request->expectsJson() || $request->ajax()) {
            return Reply::successWithData('', ['data' => $requests]);
        }

        return Inertia::render('EditAccessRequests/Index', [
            'pageTitle' => 'Edit Access Requests',
        ]);
    }

    public function show(int $id)
    {
        $editAccessRequest = PropertyEditAccessRequest::with([
            'property:id,title,reference_code,city,area,status,property_type,sale_type,display_title',
            'requestingAgent:id,name,email,image',
        ])->findOrFail($id);

        $this->authorize('view', $editAccessRequest);

        $user = user();

        if ($this->isPrivilegedUser($user) || $user->id === $editAccessRequest->responsible_agent_id) {
            $editAccessRequest->load('responsibleAgent:id,name,email,image');
        } else {
            $editAccessRequest->makeHidden(['responsible_agent_id']);
        }

        return Reply::successWithData('', ['data' => $editAccessRequest]);
    }

    public function store(Request $request)
    {
        $this->authorize('create', PropertyEditAccessRequest::class);

        $validated = $request->validate([
            'property_id' => 'required|exists:properties,id',
            'message' => 'nullable|string|max:1000',
        ]);

        $property = Property::with(['responsibleAgent', 'addedBy'])->findOrFail($validated['property_id']);
        $requestingAgent = user();

        $this->authorize('requestEditAccess', $property);

        $responsibleAgent = $property->responsibleAgent ?? $property->addedBy;

        if (!$responsibleAgent) {
            return Reply::error(__('messages.noResponsibleAgent'));
        }

        $existingActive = PropertyEditAccessRequest::where('property_id', $property->id)
            ->where('requesting_agent_id', $requestingAgent->id)
            ->active()
            ->exists();

        if ($existingActive) {
            return Reply::error(__('messages.activeEditAccessRequestExists'));
        }

        if ($property->isCollaborator($requestingAgent->id)) {
            return Reply::error(__('messages.alreadyCollaborator'));
        }

        $editAccessRequest = PropertyEditAccessRequest::create([
            'property_id' => $property->id,
            'requesting_agent_id' => $requestingAgent->id,
            'responsible_agent_id' => $responsibleAgent->id,
            'company_id' => $property->company_id ?? $requestingAgent->company_id,
            'status' => PropertyEditAccessRequest::STATUS_PENDING,
            'message' => $validated['message'] ?? null,
        ]);

        $responsibleAgent->notify(new EditAccessRequested($editAccessRequest));

        return Reply::successWithData(
            __('messages.editAccessRequestSent'),
            ['data' => $editAccessRequest->load('property:id,title,reference_code,display_title')]
        );
    }

    public function approve(Request $request, int $id)
    {
        $editAccessRequest = PropertyEditAccessRequest::with(['property', 'requestingAgent', 'responsibleAgent'])
            ->findOrFail($id);

        $this->authorize('respond', $editAccessRequest);

        $validated = $request->validate([
            'response_message' => 'nullable|string|max:1000',
        ]);

        $editAccessRequest->update([
            'status' => PropertyEditAccessRequest::STATUS_APPROVED,
            'response_message' => $validated['response_message'] ?? null,
            'reviewed_by' => user()->id,
            'reviewed_at' => now(),
        ]);

        $this->collaboratorService->grant(
            $editAccessRequest->property,
            $editAccessRequest->requesting_agent_id,
            \App\Models\PropertyCollaborator::GRANTED_VIA_ACCESS_REQUEST,
            user()->id,
        );

        $editAccessRequest->requestingAgent->notify(
            new EditAccessReviewed($editAccessRequest->fresh())
        );

        return Reply::successWithData(
            __('messages.editAccessRequestApproved'),
            ['data' => $editAccessRequest->fresh()]
        );
    }

    public function deny(Request $request, int $id)
    {
        $editAccessRequest = PropertyEditAccessRequest::with(['property', 'requestingAgent', 'responsibleAgent'])
            ->findOrFail($id);

        $this->authorize('respond', $editAccessRequest);

        $validated = $request->validate([
            'response_message' => 'nullable|string|max:1000',
        ]);

        $editAccessRequest->update([
            'status' => PropertyEditAccessRequest::STATUS_DENIED,
            'response_message' => $validated['response_message'] ?? null,
            'reviewed_by' => user()->id,
            'reviewed_at' => now(),
        ]);

        $editAccessRequest->requestingAgent->notify(
            new EditAccessReviewed($editAccessRequest->fresh())
        );

        return Reply::successWithData(
            __('messages.editAccessRequestDenied'),
            ['data' => $editAccessRequest->fresh()]
        );
    }

    public function forProperty(int $propertyId)
    {
        $property = Property::findOrFail($propertyId);
        $user = user();

        $query = PropertyEditAccessRequest::with([
            'requestingAgent:id,name,email,image',
        ])->forProperty($propertyId);

        if (!$this->isPrivilegedUser($user)) {
            $query->forAgent($user->id);
        } else {
            $query->with('responsibleAgent:id,name,email,image');
        }

        $requests = $query->orderByDesc('created_at')->get();

        if (!$this->isPrivilegedUser($user)) {
            $requests->transform(function ($req) use ($user) {
                if ($user->id !== $req->responsible_agent_id) {
                    $req->makeHidden(['responsible_agent_id']);
                    $req->unsetRelation('responsibleAgent');
                }

                return $req;
            });
        }

        return Reply::successWithData('', ['data' => $requests]);
    }

    private function isPrivilegedUser(User $user): bool
    {
        return PropertyEditAccessRequest::isUserAdmin($user);
    }
}
