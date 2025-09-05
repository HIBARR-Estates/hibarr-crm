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

    private function normalizeChannelRequest(Request $request, string $channelType): array
    {
        $payload = $request->all();

        switch ($channelType) {
            case 'email':
                if (!isset($payload['body']) || !isset($payload['sent_at'])) {
                    throw new \Exception('Email payload missing required fields: body or sent_at');
                }
                return [
                    'channel_type' => 'email',
                    'message' => $payload['body'],
                    'timestamp' => $payload['sent_at'],

                    // ...
                ];
            case 'whatsapp':
                if (!isset($payload['text']) || !isset($payload['timestamp'])) {
                    throw new \Exception('WhatsApp payload missing required fields: text or timestamp');
                }
                return [
                    'channel_type' => 'whatsapp',
                    'message' => $payload['text'],
                    'timestamp' => $payload['timestamp'],
                    // ...
                ];
            case 'instagram':
                if (!isset($payload['caption']) || !isset($payload['created_time'])) {
                    throw new \Exception('Instagram payload missing required fields: caption or created_time');
                }
                return [
                    'channel_type' => 'instagram',
                    'message' => $payload['caption'],
                    'timestamp' => $payload['created_time'],
                    // ...
                ];
            case 'telegram':
                if (!isset($payload['message']) || !isset($payload['date'])) {
                    throw new \Exception('Telegram payload missing required fields: message or date');
                }
                return [
                    'channel_type' => 'telegram',
                    'message' => $payload['message'],
                    'timestamp' => $payload['date'],
                    // ...
                ];
            default:
                throw new \Exception('Unknown channel');
        }
    }

    private function verifyChannelRequest(Request $request, string $channelType): bool
    {
        switch ($channelType) {
            case 'email':
                // TODO:Implement email request verification logic
                break;
            case 'whatsapp':
                
                break;
            case 'instagram':
                
                break;
            case 'telegram':
                
                break;
            default:
                return false;
        }


    }

    /**
     * Store a new communication activity (External, webhook POST).
     */
    public function handleChannelWebhook(Request $request, $channelType)
    {
        // TODO: Answer question, how is the channel going to identify the lead or deal?
       
        
        //Step 0 check if the channel type is supported
        if (!in_array($channelType, ['email', 'whatsapp', 'instagram', 'telegram'])) {
            return Reply::error(__('messages.unsupportedChannel'));
        }
        //Step 1 before normalizing the payload we need to verify the request is coming from a trusted source, this will be different for each channel
        if (!$this->verifyChannelRequest($request, $channelType)) {
            return Reply::error(__('messages.invalidChannelRequestSignature'));
        }
        //Step 2 normalize the request payload, then dispatch a job to process it
        try {
            $normalizedData = $this->normalizeChannelRequest($request, $channelType);
            // Step 3 Dispatch a job to process the communication activity
            ProcessCommunicationActivityJob::dispatch($normalizedData);

            Log::info('Communication activity dispatched for processing', ['data' => $normalizedData]);

            return Reply::successWithData('Communication activity been processed', [
                'data' => null
            ]);
        } catch (\Exception $e) {
            Log::error('Schema violation: ' . $e->getMessage(), ['payload' => $request->all()]);
            return Reply::error($e->getMessage());
        }

        
    }

    /**
     * Store a new communication activity (Internally, if need be).
     */
    public function store(StoreRequest $request)
    {
        

        // Validate and create a new communication activity
        $activity = CommunicationActivity::create($request->validated());

        return Reply::successWithData('Communication activity created', [
            'data' => $activity
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