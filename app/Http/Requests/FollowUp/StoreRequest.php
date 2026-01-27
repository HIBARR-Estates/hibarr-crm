<?php

namespace App\Http\Requests\FollowUp;

use App\Http\Requests\CoreRequest;
use App\Models\Deal;

class StoreRequest extends CoreRequest
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
        $deal = Deal::findOrFail($this->deal_id);
        $setting = company();

        $rules = [
            'meeting_type_id' => 'nullable|exists:meeting_types,id',
            'location' => 'required|in:office,zoom,zoho,zoho_meet,google_meet,teams,meet,phone,physical,skype,other',
            'meeting_link' => 'nullable|url',
            'start_time' => 'required|date_format:"H:i:s"',
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

        // Frontend sends date in DD-MM-YYYY format, so validate accordingly
        $rules['next_follow_up_date'] = 'required|date_format:"d-m-Y"|after_or_equal:'.$deal->created_at->format('d-m-Y');

        return $rules;
    }

}
