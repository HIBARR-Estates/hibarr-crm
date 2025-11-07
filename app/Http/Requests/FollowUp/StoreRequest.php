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
            'location' => 'required|in:office,zoom,zoho_meet,google_meet,teams,meet,phone,skype,other',
            'meeting_link' => 'nullable|url',
            'start_time' => 'required|date_format:"H:i:s"',
        ];

        if(request()->has('send_reminder')){
            $rules['remind_time'] = 'required';
        }

        // Frontend sends date in DD-MM-YYYY format, so validate accordingly
        $rules['next_follow_up_date'] = 'required|date_format:"d-m-Y"|after_or_equal:'.$deal->created_at->format('d-m-Y');

        return $rules;
    }

}
