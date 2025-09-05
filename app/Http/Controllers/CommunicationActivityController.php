<?php

namespace App\Http\Controllers;

use Log;
use App\Helper\Reply;
use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Http\Request;
use App\Http\Requests\CommunicationActivity\StoreRequest;
use App\Jobs\ProcessCommunicationActivity;

class CommunicationActivityController extends Controller
{
    private $defaultPageSize = 20;

    /**
     * Store a new communication activity, typically called by the automation trigger.
     */
    public function store(StoreRequest $request)
    {
        

        // Validate and create a new communication activity

        // The automation trigger calls this endpoint to create a communication activity
        // we will dispatch a job to process the activity asynchronously, and send the appropriate notifications
        ProcessCommunicationActivityJob::dispatch($request->validated());

        return Reply::successWithData('Communication activity been processed', [
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

        return Reply::successWithData('Deal communication activities', [
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

        return Reply::successWithData('Lead communication activities', [
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

        return Reply::successWithData('Communication activities by channel', [
            'data' => $activities
        ]);
    }
    
}