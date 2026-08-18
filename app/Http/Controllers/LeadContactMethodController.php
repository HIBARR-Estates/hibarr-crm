<?php

namespace App\Http\Controllers;

use App\Enums\LeadContactMethodType;
use App\Exceptions\LeadContactMethodException;
use App\Helper\Reply;
use App\Http\Requests\Lead\StoreLeadContactMethodRequest;
use App\Http\Requests\Lead\UpdateLeadContactMethodRequest;
use App\Models\Lead;
use App\Models\LeadContactMethod;
use App\Services\LeadContactMethodService;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;

class LeadContactMethodController extends AccountBaseController
{
    public function __construct(
        private LeadContactMethodService $contactMethodService,
    ) {
        parent::__construct();
    }

    public function index(Lead $lead): JsonResponse
    {
        $this->assertLeadAccess($lead, 'view_lead');

        $methods = $lead->contactMethods()
            ->orderByDesc('is_main')
            ->orderBy('type')
            ->orderBy('id')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $methods,
        ]);
    }

    public function store(StoreLeadContactMethodRequest $request, Lead $lead): JsonResponse
    {
        $this->assertLeadAccess($lead, 'edit_lead');

        try {
            $method = $this->contactMethodService->createUserAlternate(
                $lead,
                LeadContactMethodType::from($request->validated('type')),
                $request->input('identifier'),
            );
        } catch (LeadContactMethodException $e) {
            return $this->fail($e);
        }

        return response()->json(Reply::successWithData(__('messages.recordSaved'), [
            'data' => $method,
            'contact_methods' => $this->methodsFor($lead),
        ]));
    }

    public function update(
        UpdateLeadContactMethodRequest $request,
        Lead $lead,
        LeadContactMethod $contactMethod,
    ): JsonResponse {
        $this->assertLeadAccess($lead, 'edit_lead');
        $this->assertMethodOnLead($lead, $contactMethod);

        try {
            $method = $this->contactMethodService->updateUserAlternate(
                $lead,
                $contactMethod,
                $request->input('identifier'),
            );
        } catch (LeadContactMethodException $e) {
            return $this->fail($e);
        }

        return response()->json(Reply::successWithData(__('messages.updateSuccess'), [
            'data' => $method,
            'contact_methods' => $this->methodsFor($lead),
        ]));
    }

    public function destroy(Lead $lead, LeadContactMethod $contactMethod): JsonResponse
    {
        $this->assertLeadAccess($lead, 'edit_lead');
        $this->assertMethodOnLead($lead, $contactMethod);

        try {
            $this->contactMethodService->deleteUserAlternate($lead, $contactMethod);
        } catch (LeadContactMethodException $e) {
            return $this->fail($e);
        }

        return response()->json(Reply::successWithData(__('messages.deleteSuccess'), [
            'contact_methods' => $this->methodsFor($lead),
        ]));
    }

    /**
     * @param  'view_lead'|'edit_lead'  $permission
     */
    private function assertLeadAccess(Lead $lead, string $permission): void
    {
        abort_if((int) $lead->company_id !== (int) company()->id, 404);

        $access = PermissionService::checkAccess(user(), $permission, $lead, [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ]);

        abort_403(! $access['canAccess']);
    }

    private function assertMethodOnLead(Lead $lead, LeadContactMethod $method): void
    {
        abort_unless((int) $method->lead_id === (int) $lead->id, 404);
    }

    private function methodsFor(Lead $lead)
    {
        return $lead->contactMethods()
            ->orderByDesc('is_main')
            ->orderBy('type')
            ->orderBy('id')
            ->get();
    }

    private function fail(LeadContactMethodException $e): JsonResponse
    {
        return response()->json([
            'status' => 'fail',
            'message' => $e->getMessage(),
            'conflicts' => $e->conflicts,
        ], 422);
    }
}
