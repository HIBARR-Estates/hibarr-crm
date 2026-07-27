<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\Lead\FindDuplicatesRequest;
use App\Http\Requests\Lead\MergeLeadRequest;
use App\Models\Lead;
use App\Services\LeadDuplicateDetectionService;
use App\Services\LeadMergeService;
use App\Services\PermissionService;
use App\Support\FeatureFlags;
use InvalidArgumentException;

class LeadMergeController extends AccountBaseController
{
    public function __construct(
        private LeadMergeService $mergeService,
        private LeadDuplicateDetectionService $duplicateDetectionService,
    ) {
        parent::__construct();
    }

    public function merge(MergeLeadRequest $request, Lead $lead)
    {
        $this->assertFeatureEnabled();
        $this->assertCanMergeLead($lead);

        $duplicate = Lead::query()->findOrFail($request->integer('duplicate_id'));
        $this->assertCanMergeLead($duplicate);

        $ownershipPicks = array_filter(
            [
                'lead_owner' => $request->input('lead_owner'),
                'added_by' => $request->input('added_by'),
                'client_id' => $request->input('client_id'),
                'agent_id' => $request->input('agent_id'),
            ],
            static fn ($value) => $value !== null,
        );

        try {
            $merged = $this->mergeService->merge(
                $lead,
                $duplicate,
                $ownershipPicks,
                user()?->id,
            );
        } catch (InvalidArgumentException $e) {
            return Reply::error($e->getMessage());
        }

        return Reply::successWithData(__('messages.updateSuccess'), [
            'lead' => $merged,
            'merged_into_lead_id' => $merged->id,
            'duplicate_id' => $duplicate->id,
        ]);
    }

    public function duplicates(FindDuplicatesRequest $request, Lead $lead)
    {
        $this->assertFeatureEnabled();
        $this->assertCanMergeLead($lead);

        $candidates = $this->duplicateDetectionService->findDuplicates($lead);

        return Reply::successWithData(__('messages.recordSaved'), [
            'duplicates' => $candidates->map(static function (Lead $candidate) {
                return [
                    'id' => $candidate->id,
                    'client_name' => $candidate->client_name,
                    'client_email' => $candidate->client_email,
                    'mobile' => $candidate->mobile,
                    'cell' => $candidate->cell,
                    'company_name' => $candidate->company_name,
                    'lead_owner' => $candidate->lead_owner,
                    'added_by' => $candidate->added_by,
                ];
            })->values(),
        ]);
    }

    public function review(Lead $lead, Lead $duplicate)
    {
        $this->assertFeatureEnabled();
        $this->assertCanMergeLead($lead);
        $this->assertCanMergeLead($duplicate);

        try {
            $review = $this->mergeService->buildReview($lead, $duplicate);
        } catch (InvalidArgumentException $e) {
            return Reply::error($e->getMessage());
        }

        return Reply::successWithData(__('messages.recordSaved'), array_merge([
            'primary' => $this->presentLeadSummary($lead),
            'duplicate' => $this->presentLeadSummary($duplicate),
        ], $review));
    }

    private function presentLeadSummary(Lead $lead): array
    {
        return [
            'id' => $lead->id,
            'client_name' => $lead->client_name,
            'client_email' => $lead->client_email,
            'mobile' => $lead->mobile,
            'cell' => $lead->cell,
            'office' => $lead->office,
            'company_name' => $lead->company_name,
            'address' => $lead->address,
            'client_whatsapp' => $lead->client_whatsapp,
            'client_telegram' => $lead->client_telegram,
            'client_instagram' => $lead->client_instagram,
        ];
    }

    private function assertFeatureEnabled(): void
    {
        abort_unless(FeatureFlags::enabled('crm.lead-merge'), 404);
    }

    private function assertCanMergeLead(Lead $lead): void
    {
        abort_if((int) $lead->company_id !== (int) company()->id, 404);

        $leadRules = [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ];

        $access = PermissionService::checkAccess(user(), 'merge_lead', $lead, $leadRules);

        abort_unless($access['canAccess'], 403);
    }
}
