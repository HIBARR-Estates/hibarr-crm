<?php

namespace App\Http\Controllers;

use Log;
use App\Helper\Reply;
use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Http\Request;
use App\Http\Requests\CommunicationActivity\StoreRequest;
use App\Jobs\CreateCommunicationActivityJob;

class CommunicationActivityController extends Controller
{
    private $defaultPageSize = 20;

    /**
     * Store a new communication activity, typically called by the automation trigger.
     */
    public function store(StoreRequest $request)
    {
        // get the company id from the header and attach it to the request
        $companyId = $request->header('X-COMPANY-ID');

        if (!$companyId) {
            return Reply::error(__('messages.missingCompanyId'));
        }

        // Validate and create a new communication activity

        // The automation trigger calls this endpoint to create a communication activity
        // we will dispatch a job to process the activity asynchronously, and send the appropriate notifications
        CreateCommunicationActivityJob::dispatch(array_merge($request->validated(), [
            'company_id' => $companyId
        ]), $request->get('can_create_deal', false));

        return Reply::successWithData(__('messages.processingCommunicationActivity'), [
            'data' => null
        ]);
    }

    /**
     * Get communication activities for a specific deal.
     */
    public function getDealActivities(Request $request, $dealId)
    {
        $perPage = $request->get('per_page', $this->defaultPageSize);
        $activities = CommunicationActivity::where('deal_id', $dealId)
            ->orderByDesc('timestamp')
            ->paginate($perPage);

        return Reply::successWithData(__('messages.dealCommunicationActities'), [
            'data' => $activities
        ]);
    }

    /**
     * Get communication activities for a specific lead.
     */
    public function getLeadActivities(Request $request, $leadId)
    {
        $perPage = $request->get('per_page', $this->defaultPageSize);
        $activities = CommunicationActivity::where('lead_id', $leadId)
            ->orderByDesc('timestamp')
            ->paginate($perPage);

        return Reply::successWithData(__('messages.leadCommunicationActities'), [
            'data' => $activities
        ]);
    }

    /**
     * Get communication activities filtered by channel type.
     */
    public function getActivitiesByChannel(Request $request, $channelType)
    {
        $perPage = $request->get('per_page', $this->defaultPageSize);
        $activities = CommunicationActivity::where('channel_type', $channelType)
            ->orderByDesc('timestamp')
            ->paginate($perPage);

        return Reply::successWithData(__('messages.communicationActivitiesByChannel'), [
            'data' => $activities
        ]);
    }
    
}