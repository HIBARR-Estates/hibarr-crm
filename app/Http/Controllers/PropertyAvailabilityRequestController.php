<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Property;
use App\Models\PropertyAvailabilityRequest;
use App\Models\User;
use App\Notifications\AvailabilityRequested;
use App\Notifications\AvailabilityResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PropertyAvailabilityRequestController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * List availability requests.
     * - Admins / sales_manager / legal: see all
     * - Regular agents: see only requests they sent or received
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', PropertyAvailabilityRequest::class);

        $user = user();
        $query = PropertyAvailabilityRequest::with([
            'property:id,title,reference_code,city,area,status,property_type,sale_type',
            'requestingAgent:id,name,email,image',
        ]);

        // Admins and privileged roles see all; others see only their own
        if (!$this->isPrivilegedUser($user)) {
            $query->forAgent($user->id);

            // Non-privileged users: strip responsible agent details from results
        }

        // Filter by status
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Filter by property
        if ($propertyId = $request->input('property_id')) {
            $query->forProperty($propertyId);
        }

        // Filter: requests I sent vs requests I received
        if ($direction = $request->input('direction')) {
            if ($direction === 'sent') {
                $query->where('requesting_agent_id', $user->id);
            } elseif ($direction === 'received') {
                $query->where('responsible_agent_id', $user->id);
            }
        }

        $requests = $query->orderByDesc('created_at')->paginate(20);

        // For privileged users, also eager-load responsible agent
        if ($this->isPrivilegedUser($user)) {
            $requests->load('responsibleAgent:id,name,email,image');
        }

        // Strip responsible agent info for non-privileged users
        if (!$this->isPrivilegedUser($user)) {
            $requests->getCollection()->transform(function ($req) {
                $req->makeHidden(['responsible_agent_id']);
                $req->unsetRelation('responsibleAgent');
                return $req;
            });
        }

        // Inertia page visit vs API (AJAX) call
        // if ($request->expectsJson() || $request->ajax()) {
        //     return Reply::successWithData('', ['data' => $requests]);
        // }

        return Inertia::render('AvailabilityRequests/Index', [
            'pageTitle' => 'Availability Requests',
        ]);
    }

    /**
     * Show a single availability request.
     */
    public function show(int $id)
    {
        $availabilityRequest = PropertyAvailabilityRequest::with([
            'property:id,title,reference_code,city,area,status,property_type,sale_type',
            'requestingAgent:id,name,email,image',
        ])->findOrFail($id);

        $this->authorize('view', $availabilityRequest);

        $user = user();

        // Only privileged users see the responsible agent
        if ($this->isPrivilegedUser($user) || $user->id === $availabilityRequest->responsible_agent_id) {
            $availabilityRequest->load('responsibleAgent:id,name,email,image');
        } else {
            $availabilityRequest->makeHidden(['responsible_agent_id']);
        }

        return Reply::successWithData('', ['data' => $availabilityRequest]);
    }

    /**
     * Create a new availability request for a property.
     */
    public function store(Request $request)
    {
        $this->authorize('create', PropertyAvailabilityRequest::class);

        $validated = $request->validate([
            'property_id' => 'required|exists:properties,id',
            'message' => 'nullable|string|max:1000',
        ]);

        $property = Property::with(['responsibleAgent', 'addedBy'])->findOrFail($validated['property_id']);
        $requestingAgent = user();

        // Determine the responsible agent
        $responsibleAgent = $property->responsibleAgent ?? $property->addedBy;

        if (!$responsibleAgent) {
            return Reply::error(__('messages.noResponsibleAgent'));
        }

        // Cannot request your own property
        if ($responsibleAgent->id === $requestingAgent->id || $property->added_by === $requestingAgent->id) {
            return Reply::error(__('messages.cannotRequestOwnProperty'));
        }

        // Check if there's already an active request for this property by this agent
        $existingActive = PropertyAvailabilityRequest::where('property_id', $property->id)
            ->where('requesting_agent_id', $requestingAgent->id)
            ->active()
            ->exists();

        if ($existingActive) {
            return Reply::error(__('messages.activeRequestExists'));
        }

        // Create the request
        $availabilityRequest = PropertyAvailabilityRequest::create([
            'property_id' => $property->id,
            'requesting_agent_id' => $requestingAgent->id,
            'responsible_agent_id' => $responsibleAgent->id,
            'company_id' => $property->company_id ?? $requestingAgent->company_id,
            'status' => PropertyAvailabilityRequest::STATUS_PENDING,
            'message' => $validated['message'] ?? null,
            'expires_at' => PropertyAvailabilityRequest::calculateExpiresAt(),
        ]);

        // Notify the responsible agent
        $responsibleAgent->notify(new AvailabilityRequested($availabilityRequest));

        return Reply::successWithData(
            __('messages.availabilityRequestSent'),
            ['data' => $availabilityRequest->load('property:id,title,reference_code')]
        );
    }

    /**
     * Approve an availability request.
     */
    public function approve(Request $request, int $id)
    {
        $availabilityRequest = PropertyAvailabilityRequest::with(['property', 'requestingAgent', 'responsibleAgent'])
            ->findOrFail($id);

        $this->authorize('respond', $availabilityRequest);

        $validated = $request->validate([
            'response_message' => 'nullable|string|max:1000',
        ]);

        $availabilityRequest->update([
            'status' => PropertyAvailabilityRequest::STATUS_APPROVED,
            'response_message' => $validated['response_message'] ?? null,
            'responded_at' => now(),
        ]);

        // Notify the requesting agent
        $availabilityRequest->requestingAgent->notify(
            new AvailabilityResponse($availabilityRequest)
        );

        return Reply::successWithData(
            __('messages.availabilityRequestApproved'),
            ['data' => $availabilityRequest->fresh()]
        );
    }

    /**
     * Deny an availability request.
     */
    public function deny(Request $request, int $id)
    {
        $availabilityRequest = PropertyAvailabilityRequest::with(['property', 'requestingAgent', 'responsibleAgent'])
            ->findOrFail($id);

        $this->authorize('respond', $availabilityRequest);

        $validated = $request->validate([
            'response_message' => 'nullable|string|max:1000',
        ]);

        $availabilityRequest->update([
            'status' => PropertyAvailabilityRequest::STATUS_DENIED,
            'response_message' => $validated['response_message'] ?? null,
            'responded_at' => now(),
        ]);

        // Notify the requesting agent
        $availabilityRequest->requestingAgent->notify(
            new AvailabilityResponse($availabilityRequest)
        );

        return Reply::successWithData(
            __('messages.availabilityRequestDenied'),
            ['data' => $availabilityRequest->fresh()]
        );
    }

    /**
     * Get availability requests for a specific property (used by property detail view).
     */
    public function forProperty(int $propertyId)
    {
        $property = Property::findOrFail($propertyId);
        $user = user();

        $query = PropertyAvailabilityRequest::with([
            'requestingAgent:id,name,email,image',
        ])->forProperty($propertyId);

        // Non-privileged users only see their own requests for this property
        if (!$this->isPrivilegedUser($user)) {
            $query->forAgent($user->id);
        } else {
            $query->with('responsibleAgent:id,name,email,image');
        }

        $requests = $query->orderByDesc('created_at')->get();

        // Strip responsible agent info for non-privileged
        if (!$this->isPrivilegedUser($user)) {
            $requests->transform(function ($req) {
                $req->makeHidden(['responsible_agent_id']);
                $req->unsetRelation('responsibleAgent');
                return $req;
            });
        }

        return Reply::successWithData('', ['data' => $requests]);
    }

    /**
     * Quick action endpoint: respond from email link.
     * Uses signed URL for authentication.
     */
    public function respondFromEmail(Request $request, int $id, string $action)
    {
        if (!$request->hasValidSignature()) {
            abort(403, 'Invalid or expired link.');
        }

        $availabilityRequest = PropertyAvailabilityRequest::with(['property', 'requestingAgent', 'responsibleAgent'])
            ->findOrFail($id);

        if (!$availabilityRequest->isActive()) {
            return redirect()->route('account.dashboard')
                ->with('error', __('messages.requestAlreadyResolved'));
        }

        if ($action === 'approve') {
            $availabilityRequest->update([
                'status' => PropertyAvailabilityRequest::STATUS_APPROVED,
                'responded_at' => now(),
            ]);

            $availabilityRequest->requestingAgent->notify(
                new AvailabilityResponse($availabilityRequest)
            );

            return redirect()->route('account.dashboard')
                ->with('success', __('messages.availabilityRequestApproved'));
        } elseif ($action === 'deny') {
            $availabilityRequest->update([
                'status' => PropertyAvailabilityRequest::STATUS_DENIED,
                'responded_at' => now(),
            ]);

            $availabilityRequest->requestingAgent->notify(
                new AvailabilityResponse($availabilityRequest)
            );

            return redirect()->route('account.dashboard')
                ->with('success', __('messages.availabilityRequestDenied'));
        }

        abort(400, 'Invalid action.');
    }

    /**
     * Check if user is admin, sales_manager, or legal.
     */
    private function isPrivilegedUser(User $user): bool
    {
        $permission = $user->permission('edit_products');
        if ($permission === 'all' || $permission === 4) {
            return true;
        }

        return $user->roles()->whereIn('name', ['sales_manager', 'legal'])->exists();
    }
}
