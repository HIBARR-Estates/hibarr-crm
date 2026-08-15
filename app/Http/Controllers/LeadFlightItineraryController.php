<?php



namespace App\Http\Controllers;



use App\Models\Deal;

use App\Models\Lead;

use App\Models\LeadFlightItinerary;

use App\Helper\Reply;

use App\Services\PermissionService;

use Illuminate\Http\RedirectResponse;

use Illuminate\Http\Request;

use Illuminate\Support\Facades\DB;

use Illuminate\Validation\Rule;

use Illuminate\Validation\ValidationException;

use Carbon\Carbon;



class LeadFlightItineraryController extends Controller

{

    private const ITINERARY_STATUSES = [
        'not arrived',
        'arrived',
        'not departed',
        'departed',
    ];

    private const DEPARTURE_STATUSES = [
        'not departed',
        'departed',
    ];

    public function store(Request $request)

    {

        $request->validate([

            'lead_id' => 'required_without:deal_id|exists:leads,id',

            'deal_id' => 'nullable|exists:deals,id',

            'direction' => 'required|in:arrival,departure',

            'airport_name' => 'nullable|string',

            'flight_number' => 'nullable|string',

            'flight_date' => 'nullable|date',

            'status' => ['nullable', Rule::in(self::ITINERARY_STATUSES)],

            'is_transfer_required' => 'boolean',

            'is_roundtrip' => 'boolean',

            'return_airport_name' => 'required_if:is_roundtrip,true|nullable|string',

            'return_flight_number' => 'required_if:is_roundtrip,true|nullable|string',

            'return_flight_date' => 'required_if:is_roundtrip,true|nullable|date',

            'return_status' => ['nullable', Rule::in(self::DEPARTURE_STATUSES)],

            'ticket_image_url' => 'nullable|string',

            'return_ticket_image_url' => 'nullable|string',

        ]);



        $data = $request->only([

            'lead_id', 'deal_id', 'direction', 'airport_name', 

            'flight_number', 'status', 'is_transfer_required', 'ticket_image_url',

            'remind_at', 'reminders',

        ]);

        

        if (!empty($data['deal_id'])) {

            $deal = Deal::findOrFail($data['deal_id']);



            if (

                $request->filled('lead_id')

                && (int) $request->lead_id !== (int) $deal->lead_id

            ) {

                throw ValidationException::withMessages([

                    'lead_id' => [__('The lead does not match the selected deal.')],

                ]);

            }



            if (empty($deal->lead_id)) {

                throw ValidationException::withMessages([

                    'deal_id' => [__('The selected deal is not linked to a lead.')],

                ]);

            }



            $data['lead_id'] = $deal->lead_id;

        }



        if ($response = $this->authorizeItineraryContext($data)) {

            return $response;

        }



        if ($request->filled('flight_date')) {

            $data['flight_date'] = Carbon::parse($request->flight_date)->toDateTimeString();

        }



        if (!$request->filled('status')) {

            $data['status'] = $data['direction'] === 'departure' ? 'not departed' : 'not arrived';

        }



        if ($request->input('is_roundtrip')) {

            $data['direction'] = 'arrival';

            if (!$request->filled('status')) {

                $data['status'] = 'not arrived';

            }

        }



        $created = null;

        DB::transaction(function () use ($request, $data, &$created) {
            $created = LeadFlightItinerary::create($data);

            if ($request->input('is_roundtrip')) {
                $returnLeg = [
                    'lead_id' => $data['lead_id'],
                    'deal_id' => $data['deal_id'] ?? null,
                    'direction' => 'departure',
                    'airport_name' => $request->input('return_airport_name'),
                    'flight_number' => $request->input('return_flight_number'),
                    'status' => $request->input('return_status', 'not departed'),
                    'is_transfer_required' => (bool) $request->input('is_transfer_required', false),
                    'ticket_image_url' => $request->input('return_ticket_image_url'),
                ];

                if ($request->filled('return_flight_date')) {
                    $returnLeg['flight_date'] = Carbon::parse($request->return_flight_date)->toDateTimeString();
                }

                $returnCreated = LeadFlightItinerary::create($returnLeg);
                app(\App\Services\Reminders\FlightItineraryReminderSync::class)->syncFromItinerary($returnCreated->fresh(['lead', 'deal.leadAgent']));
            }
        });

        if ($created) {
            app(\App\Services\Reminders\FlightItineraryReminderSync::class)->syncFromItinerary($created->fresh(['lead', 'deal.leadAgent']));
        }

        // Axios / redesign workspace expects the created leg so the list can
        // update without a full page reload (redirect alone leaves local state stale).
        if ($request->wantsJson() || $request->ajax()) {
            return Reply::successWithData(
                __('pages.flight_itinerary.messages.added'),
                ['data' => $created]
            );
        }

        return redirect()->back()->with('success', __('pages.flight_itinerary.messages.added'));

    }



    public function update(Request $request, LeadFlightItinerary $leadFlightItinerary)

    {

        if ($response = $this->authorizeItineraryRecord($leadFlightItinerary)) {

            return $response;

        }



        $request->validate([

            'direction' => 'required|in:arrival,departure',

            'airport_name' => 'nullable|string',

            'flight_number' => 'nullable|string',

            'flight_date' => 'nullable|date',

            'status' => ['nullable', Rule::in(self::ITINERARY_STATUSES)],

            'is_transfer_required' => 'boolean',

            'ticket_image_url' => 'nullable|string',

        ]);



        $data = $request->only([

            'direction', 'airport_name', 'flight_number', 

            'status', 'is_transfer_required', 'ticket_image_url',

            'remind_at', 'reminders',

        ]);



        if ($request->has('ticket_image_url')) {

            $data['ticket_image_url'] = $request->filled('ticket_image_url')

                ? $request->ticket_image_url

                : null;

        }



        if ($request->has('flight_date')) {

            $data['flight_date'] = $request->filled('flight_date')

                ? Carbon::parse($request->flight_date)->toDateTimeString()

                : null;

        }



        $leadFlightItinerary->update($data);

        app(\App\Services\Reminders\FlightItineraryReminderSync::class)
            ->syncFromItinerary($leadFlightItinerary->fresh(['lead', 'deal.leadAgent']));

    

        return redirect()->back()->with('success', __('pages.flight_itinerary.messages.updated'));

    }



    public function destroy(LeadFlightItinerary $leadFlightItinerary)

    {

        if ($response = $this->authorizeItineraryRecord($leadFlightItinerary, 'edit')) {

            return $response;

        }



        app(\App\Services\Reminders\FlightItineraryReminderSync::class)
            ->cancelForItinerary($leadFlightItinerary);

        $leadFlightItinerary->delete();

        return redirect()->back()->with('success', __('pages.flight_itinerary.messages.deleted'));

    }



    private function dealAccessRules(): array

    {

        return [

            'added' => 'added_by',

            // Write gate (edit/delete): agent/participant only, watchers stay view-only.
            'owned' => fn ($user, $deal) => $deal->hasTeamMemberAccess($user->id),

        ];

    }



    private function leadAccessRules(): array

    {

        return [

            'added' => 'added_by',

            'owned' => 'lead_owner',

        ];

    }



    private function authorizeItineraryContext(array $data, string $action = 'edit'): ?RedirectResponse

    {

        $permission = $action === 'delete'

            ? (!empty($data['deal_id']) ? 'delete_deals' : 'delete_lead')

            : (!empty($data['deal_id']) ? 'edit_deals' : 'edit_lead');



        if (!empty($data['deal_id'])) {

            $deal = Deal::findOrFail($data['deal_id']);



            if ($response = $this->denyIfDealLocked($deal)) {

                return $response;

            }



            return $this->denyUnlessCanAccess(

                PermissionService::checkAccess(user(), $permission, $deal, $this->dealAccessRules())

            );

        }



        abort_403(empty($data['lead_id']));



        $lead = Lead::findOrFail($data['lead_id']);



        return $this->denyUnlessCanAccess(

            PermissionService::checkAccess(user(), $permission, $lead, $this->leadAccessRules())

        );

    }



    private function authorizeItineraryRecord(

        LeadFlightItinerary $itinerary,

        string $action = 'edit',

    ): ?RedirectResponse {

        return $this->authorizeItineraryContext([

            'deal_id' => $itinerary->deal_id,

            'lead_id' => $itinerary->lead_id,

        ], $action);

    }



    private function denyUnlessCanAccess(array $access): ?RedirectResponse

    {

        if ($access['canAccess']) {

            return null;

        }



        if (request()->header('X-Inertia')) {

            return redirect()->back()->with('error', __('messages.permissionDenied'));

        }



        abort_403(true);



        return null;

    }



    private function denyIfDealLocked(Deal $deal): ?RedirectResponse

    {

        if (!$deal->isLocked()) {

            return null;

        }



        if (request()->header('X-Inertia')) {

            return redirect()->back()->with('error', __('messages.dealLocked'));

        }



        abort_403(true);



        return null;

    }

}


