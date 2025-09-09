<?php

namespace Modules\Zoom\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Company;
use Carbon\Carbon;
use Modules\Zoom\Entities\ZoomMeeting;
use Modules\Zoom\Entities\ZoomSetting;
use Modules\Zoom\Events\MeetingInviteEvent;

class ZoomWebhookController extends Controller
{

    public function index($companyHash = null)
    {
        $response = request()->all();
        $event = request()->event;

        switch ($event) {

        case 'meeting.started':
            $this->meetingStarted($response);
            break;

        case 'meeting.ended':
            $this->meetingEnded($response);
            break;

        case 'meeting.deleted':
            $this->meetingDeleted($response);
            break;

        case 'meeting.created':
            $this->meetingCreated($response);
            break;

        case 'meeting.updated':
            $this->meetingUpdated($response);
            break;

        case 'endpoint.url_validation':
            return $this->validateEndpointUrl($response, $companyHash);

        default:
            //
            break;
        }

        return response('Webhook Handled');
    }

    protected function validateEndpointUrl($response, $companyHash)
    {
        $company_id = Company::select('id')->where('hash', $companyHash)->first();

        $secret = ZoomSetting::where('company_id', $company_id->id)->first();

        $token = hash_hmac('sha256', $response['payload']['plainToken'], $secret->secret_token);

        $plain_token = $response['payload']['plainToken'];

        return response(['plainToken' => $plain_token, 'encryptedToken' => $token]);

    }

    protected function meetingStarted($response)
    {
        $zoomMeetingId = $response['payload']['object']['id'];
        $startTime = Carbon::parse($response['payload']['object']['start_time'])->toDateString();

        $meetings = ZoomMeeting::where('meeting_id', $zoomMeetingId)->count();

        if ($meetings > 1) {

            $meeting = ZoomMeeting::where('meeting_id', $zoomMeetingId)
                ->whereDate('start_date_time', $startTime)
                ->first();

        }
        else {

            $meeting = ZoomMeeting::where('meeting_id', $zoomMeetingId)->first();
        }

        if ($meeting) {
            $meeting->status = 'live';
            $meeting->save();
        }
    }

    protected function meetingEnded($response)
    {
        $zoomMeetingId = $response['payload']['object']['id'];
        $startTime = Carbon::parse($response['payload']['object']['start_time'])->toDateString();

        $meetings = ZoomMeeting::where('meeting_id', $zoomMeetingId)->count();

        if ($meetings > 1) {
            $meeting = ZoomMeeting::where('meeting_id', $zoomMeetingId)
                ->whereDate('start_date_time', $startTime)
                ->first();

            if ($meeting) {
                $meeting->status = 'finished';
                $meeting->save();
            }
        }
        else {
            $meeting = ZoomMeeting::where('meeting_id', $zoomMeetingId)->first();

            if ($meeting) {
                $meeting->status = 'finished';
                $meeting->save();
            }
        }
    }

    protected function meetingDeleted($response)
    {
        $zoomMeetingId = $response['payload']['object']['id'];

        // Delete only occurrence if repeated meeting
        $meetings = ZoomMeeting::where('meeting_id', $zoomMeetingId)->orderBy('id')->get();

        if (!is_null($meetings) && $meetings->count() > 1) {

            if (isset($response['payload']['operation'])
                && $response['payload']['operation'] == 'all'
            ) {
                ZoomMeeting::where('meeting_id', $zoomMeetingId)->delete();

            }
            else {
                $occurrences = $response['payload']['object']['occurrences'];

                foreach ($meetings as $key => $value) {
                    $occurrenceId = $occurrences[$key]['occurrence_id'];
                    ZoomMeeting::where('occurrence_id', $occurrenceId)->delete();
                }
            }
        }
        else {
            ZoomMeeting::where('meeting_id', $zoomMeetingId)->delete();
        }
    }

    protected function meetingCreated($response)
    {
        $zoomMeetingId = $response['payload']['object']['id'];
        $meeting = ZoomMeeting::with('attendees', 'company')->where('meeting_id', $zoomMeetingId)->first();

        if (!is_null($meeting) && $meeting->repeat == 1) {
            $occurrences = $response['payload']['object']['occurrences'];

            foreach ($occurrences as $key => $value) {

                if ($key == 0) {
                    $meeting->occurrence_id = $value['occurrence_id'];
                    $meeting->start_date_time = Carbon::parse($value['start_time'])->timezone($meeting->company->timezone)->toDateTimeString();
                    $meeting->end_date_time = Carbon::parse($value['start_time'])->timezone($meeting->company->timezone)->addMinutes($value['duration'])->toDateTimeString();
                    $meeting->save();
                    event(new MeetingInviteEvent($meeting, $meeting->attendees));

                }
                else {
                    $occurrence = $meeting->replicate()->fill(
                        [
                            'occurrence_id' => $value['occurrence_id'],
                            'occurrence_order' => $key + 1,
                            'start_date_time' => Carbon::parse($value['start_time'])->timezone($meeting->company->timezone)->toDateTimeString(),
                            'end_date_time' => Carbon::parse($value['start_time'])->timezone($meeting->company->timezone)->addMinutes($value['duration'])->toDateTimeString(),
                        ]
                    );

                    $occurrence->save();
                    $attendees = $meeting->attendees->pluck('id')->toArray();
                    $occurrence->attendees()->sync($attendees);
                }
            }
        }
    }

    protected function meetingUpdated($response)
    {
        $zoomMeetingId = $response['payload']['object']['id'];

        $meetings = ZoomMeeting::where('meeting_id', $zoomMeetingId)->orderBy('id')->get();

        if (!is_null($meetings) && $meetings->count() > 1) {

            $occurrences = $response['payload']['object']['occurrences'];

            foreach ($meetings as $key => $meeting) {

                $occurrenceId = $occurrences[$key]['occurrence_id'];

                if (!isset($occurrences[$key]['start_time'])) {
                    continue;
                }

                $startTime = Carbon::parse($occurrences[$key]['start_time'])->timezone($meeting->company->timezone)->toDateTimeString();
                ZoomMeeting::where('occurrence_id', $occurrenceId)->update(
                    [
                        'start_date_time' => $startTime,
                        'end_date_time' => Carbon::parse($occurrences[$key]['start_time'])->timezone($meeting->company->timezone)->addMinutes($occurrences[$key]['duration'])->toDateTimeString(),
                    ]
                );
            }

            return true;
        }

        $meeting = ZoomMeeting::where('meeting_id', $zoomMeetingId)->orderBy('id')->first();

        if (!isset($response['payload']['object']['start_time'])) {
            return true;
        }

        if ($meeting) {
            $startTime = Carbon::parse($response['payload']['object']['start_time'])->timezone($meeting->company->timezone)->toDateTimeString();

            ZoomMeeting::where('meeting_id', $zoomMeetingId)->update(
                [
                    'start_date_time' => $startTime,
                    'end_date_time' => Carbon::parse($response['payload']['object']['start_time'])->timezone($meeting->company->timezone)->addMinutes($response['payload']['object']['duration'])->toDateTimeString(),
                ]
            );
        }
    }

    public function getWebhook()
    {
        return response()->json(['message' => 'This URL should not be accessed directly. Only POST requests are allowed.']);
    }

}
