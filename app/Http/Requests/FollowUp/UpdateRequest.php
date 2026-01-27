<?php

namespace App\Http\Requests\FollowUp;

use App\Http\Requests\CoreRequest;

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
            'location' => 'required|in:office,zoom,zoho,zoho_meet,google_meet,teams,meet,phone,physical,skype,other',
            'meeting_link' => 'nullable|url',
            'reminders' => 'nullable|array',
            'reminders.*.time' => 'required_with:reminders|integer|min:1|max:1440',
            'reminders.*.type' => 'required_with:reminders|in:minute,hour,day',
            'participants' => 'nullable|array',
            'participants.*' => 'required_with:participants|integer|exists:users,id',
        ];

        // Zoho, office, phone, and physical meetings don't require meeting link
        if (in_array($this->location, ['zoho', 'office', 'phone', 'physical'])) {
            $rules['meeting_link'] = 'nullable|url';
        } else {
            // Video meeting platforms (zoom, google_meet, teams, etc.) require meeting link
            $rules['meeting_link'] = 'required|url';
        }

        // Video meetings (zoho) require at least one participant
        if ($this->location === 'zoho') {
            $rules['participants'] = 'required|array|min:1';
            $rules['participants.*'] = 'required|integer|exists:users,id';
        }

        return $rules;
    }

}
