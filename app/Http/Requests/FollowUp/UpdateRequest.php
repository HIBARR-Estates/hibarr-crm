<?php

namespace App\Http\Requests\FollowUp;

use App\Http\Requests\CoreRequest;
use DateTimeZone;
use Illuminate\Validation\Rule;

class UpdateRequest extends CoreRequest
{

    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        $rules = [
            'next_follow_up_date' => 'required|date_format:"d-m-Y"',
            'start_time' => 'required|date_format:"H:i:s"',
            // Known platforms plus free-text physical place names (Other location).
            'location' => 'required|string|max:255',
            'meeting_link' => 'nullable|url',
            'reminders' => 'nullable|array',
            'reminders.*.time' => 'required_with:reminders|integer|min:1|max:1440',
            'reminders.*.type' => 'required_with:reminders|in:minute,hour,day',
            'participants' => 'nullable|array',
            'participants.*' => 'required_with:participants|integer|exists:users,id',
        ];

        // Timezone must be a valid IANA identifier if provided
        $rules['timezone'] = [
            'nullable',
            'string',
            Rule::in(DateTimeZone::listIdentifiers()),
        ];

        $videoPlatformsRequiringLink = ['zoom', 'zoho_meet', 'google_meet', 'teams', 'meet', 'skype', 'other'];

        if (in_array($this->location, $videoPlatformsRequiringLink, true)) {
            $rules['meeting_link'] = 'required|url';
        } else {
            $rules['meeting_link'] = 'nullable|url';
        }

        // Video meetings (zoho) require at least one participant
        if ($this->location === 'zoho') {
            $rules['participants'] = 'required|array|min:1';
            $rules['participants.*'] = 'required|integer|exists:users,id';
        }

        return $rules;
    }

}
