<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Property;
use App\Models\PropertyPublishRequest;
use App\Models\User;
use App\Notifications\PublishRequestSubmitted;
use App\Notifications\PublishRequestReviewed;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Inertia\Inertia;

class PropertyPublishRequestController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * List publish requests.
     * - Sales Managers (admin): see all
     * - Regular agents: see only their own requests
     */
    public function index(Request $request)
    {
        $user = user();
        $query = PropertyPublishRequest::with([
            'property:id,title,display_title,reference_code,city,area,status,property_type,sale_type,is_published',
            'requestingAgent:id,name,email,image',
            'reviewer:id,name,email,image',
        ]);

        $isAdmin = $this->isPrivilegedUser($user);

        // Non-privileged users only see their own requests
        if (!$isAdmin) {
            $query->forAgent($user->id);
        }

        // Filter by status
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Filter: my submitted requests vs all (for admins)
        if ($direction = $request->input('direction')) {
            if ($direction === 'mine') {
                $query->where('requesting_agent_id', $user->id);
            } elseif ($direction === 'pending_review' && $isAdmin) {
                $query->pending();
            }
        }

        $requests = $query->orderByDesc('created_at')->paginate(20);

        // For Inertia page visits return the page; for AJAX return JSON
        // if ($request->expectsJson() || $request->ajax()) {
        //     return Reply::successWithData('', ['data' => $requests]);
        // }

        return Inertia::render('PublishRequests/Index', [
            'pageTitle' => 'Publish Requests',
        ]);
    }

    /**
     * Create a new publish request for a property.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'property_id' => 'required|exists:properties,id',
            'message'     => 'nullable|string|max:1000',
        ]);

        $property = Property::findOrFail($validated['property_id']);
        $requestingAgent = user();

        // Validate: property must not already be published
        if ($property->is_published) {
            return Reply::error('This property is already published.');
        }

        // Validate: requesting user must be creator or responsible agent
        if ($property->added_by !== $requestingAgent->id && $property->responsible_agent_id !== $requestingAgent->id) {
            return Reply::error('You do not have permission to request publishing for this property.');
        }

        // Check for existing active (pending) request
        $existingPending = PropertyPublishRequest::where('property_id', $property->id)
            ->pending()
            ->exists();

        if ($existingPending) {
            return Reply::error('A publish request for this property is already pending review.');
        }

        // Create the request
        $publishRequest = PropertyPublishRequest::create([
            'property_id'        => $property->id,
            'requesting_agent_id' => $requestingAgent->id,
            'company_id'         => $property->company_id ?? $requestingAgent->company_id,
            'status'             => PropertyPublishRequest::STATUS_PENDING,
            'message'            => $validated['message'] ?? null,
        ]);

        // Notify all Sales Managers
        $salesManagers = $this->getSalesManagers($requestingAgent->company_id);
        if ($salesManagers->isNotEmpty()) {
            Notification::send($salesManagers, new PublishRequestSubmitted($publishRequest));
        }

        return Reply::successWithData(
            'Publish request submitted successfully. A Sales Manager will review it shortly.',
            ['data' => $publishRequest->load('property:id,title,reference_code')]
        );
    }

    /**
     * Approve a publish request — SM only.
     */
    public function approve(Request $request, int $id)
    {
        $publishRequest = PropertyPublishRequest::with(['property', 'requestingAgent'])
            ->findOrFail($id);

        $user = user();

        // Only manage_property_publish_requests can approve
        if (!$this->isPrivilegedUser($user)) {
            abort(403, 'You do not have permission to approve publish requests.');
        }

        if (!$publishRequest->isPending()) {
            return Reply::error('This request has already been reviewed.');
        }

        $validated = $request->validate([
            'response_message' => 'nullable|string|max:1000',
        ]);

        // Update request
        $publishRequest->update([
            'status'           => PropertyPublishRequest::STATUS_APPROVED,
            'response_message' => $validated['response_message'] ?? null,
            'reviewed_by'      => $user->id,
            'reviewed_at'      => now(),
        ]);

        // Actually publish the property
        $publishRequest->property->publish();

        // Notify the requesting agent
        $publishRequest->requestingAgent->notify(
            new PublishRequestReviewed($publishRequest)
        );

        return Reply::successWithData(
            'Publish request approved. The property is now published.',
            ['data' => $publishRequest->fresh()]
        );
    }

    /**
     * Reject a publish request — SM only.
     */
    public function reject(Request $request, int $id)
    {
        $publishRequest = PropertyPublishRequest::with(['property', 'requestingAgent'])
            ->findOrFail($id);

        $user = user();

        // Only manage_property_publish_requests can reject
        if (!$this->isPrivilegedUser($user)) {
            abort(403, 'You do not have permission to reject publish requests.');
        }

        if (!$publishRequest->isPending()) {
            return Reply::error('This request has already been reviewed.');
        }

        $validated = $request->validate([
            'response_message' => 'nullable|string|max:1000',
        ]);

        // Update request
        $publishRequest->update([
            'status'           => PropertyPublishRequest::STATUS_REJECTED,
            'response_message' => $validated['response_message'] ?? null,
            'reviewed_by'      => $user->id,
            'reviewed_at'      => now(),
        ]);

        // Notify the requesting agent
        $publishRequest->requestingAgent->notify(
            new PublishRequestReviewed($publishRequest)
        );

        return Reply::successWithData(
            'Publish request rejected.',
            ['data' => $publishRequest->fresh()]
        );
    }

    // ================================================================
    // Helpers
    // ================================================================

    /**
     * Check if user has SM-level property permissions.
     */
    /**
     * Only users with manage_property_publish_requests may approve/reject.
     * manage_properties does not include this.
     */
    private function isPrivilegedUser(User $user): bool
    {
        return \App\Support\PermissionGates::canManagePropertyPublishRequests($user);
    }

    /**
     * Users who can review property publish requests.
     */
    private function getSalesManagers(int $companyId)
    {
        $permissionIds = \App\Models\Permission::where(
            'name',
            \App\Support\PermissionGates::MANAGE_PROPERTY_PUBLISH_REQUESTS
        )->pluck('id');

        return User::where('company_id', $companyId)
            ->whereIn('id', function ($query) use ($permissionIds) {
                $query->select('user_id')
                    ->from('user_permissions')
                    ->whereIn('permission_id', $permissionIds)
                    ->where('permission_type_id', 4);
            })
            ->get();
    }
}
