<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Jobs\ProcessExternalEventJob;
use App\Models\ExternalEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ExternalEventController extends Controller
{
    /**
     * Store a new external event.
     */
    public function store(Request $request)
    {
        $companyId = $request->header('X-COMPANY-ID');

        if (!$companyId) {
            return Reply::error(__('messages.missingCompanyId'));
        }

        $validator = Validator::make($request->all(), [
            'event_type' => 'required|string',
            'payload' => 'required|array',
            'metadata' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return Reply::formErrors($validator);
        }

        $externalEvent = ExternalEvent::create([
            'company_id' => $companyId,
            'event_type' => $request->event_type,
            'payload' => $request->payload,
            'metadata' => $request->metadata,
            'status' => 'pending',
        ]);

        // Dispatch job to process the event
        ProcessExternalEventJob::dispatch($externalEvent);

        return Reply::successWithData(__('messages.eventCreated'), [
            'data' => $externalEvent
        ]);
    }

    /**
     * Retrieve external events.
     */
    public function index(Request $request)
    {
        $companyId = $request->header('X-COMPANY-ID');

        if (!$companyId) {
            return Reply::error(__('messages.missingCompanyId'));
        }

        $perPage = $request->get('per_page', 20);
        
        $query = ExternalEvent::where('company_id', $companyId);

        if ($request->has('event_type')) {
            $query->where('event_type', $request->event_type);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $events = $query->orderByDesc('created_at')->paginate($perPage);

        return Reply::successWithData(__('messages.eventsRetrieved'), [
            'data' => $events
        ]);
    }

    /**
     * Retrieve a single external event.
     */
    public function show(Request $request, $id)
    {
        $companyId = $request->header('X-COMPANY-ID');

        if (!$companyId) {
            return Reply::error(__('messages.missingCompanyId'));
        }

        $event = ExternalEvent::where('company_id', $companyId)->find($id);

        if (!$event) {
            return Reply::error(__('messages.eventNotFound'));
        }

        return Reply::successWithData(__('messages.eventRetrieved'), [
            'data' => $event
        ]);
    }
}
