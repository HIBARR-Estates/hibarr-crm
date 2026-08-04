<?php

namespace App\Http\Requests\FollowUp;

use App\Http\Requests\CoreRequest;
use App\Models\Deal;
use App\Models\Lead;
use DateTimeZone;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreRequest extends CoreRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        $rules = [
            'meeting_type_id' => 'nullable|exists:meeting_types,id',
            // Known platforms plus free-text physical place names (Other location).
            'location' => 'required|string|max:255',
            'meeting_link' => 'nullable|url',
            'start_time' => 'required|date_format:"H:i:s"',
            'reminders' => 'nullable|array',
            'reminders.*.time' => 'required_with:reminders|integer|min:1|max:1440',
            'reminders.*.type' => 'required_with:reminders|in:minute,hour,day',
            'participants' => 'nullable|array',
            'participants.*' => 'required_with:participants|integer|exists:users,id',
            'duration' => 'nullable|integer|min:1|max:600',
            'timezone' => [
                'nullable',
                'string',
                Rule::in(DateTimeZone::listIdentifiers()),
            ],
        ];

        $videoPlatformsRequiringLink = ['zoom', 'zoho_meet', 'google_meet', 'teams', 'meet', 'skype', 'other'];

        if (in_array($this->location, $videoPlatformsRequiringLink, true)) {
            $rules['meeting_link'] = 'required|url';
        } else {
            $rules['meeting_link'] = 'nullable|url';
        }

        if ($this->location === 'zoho') {
            $rules['participants'] = 'required|array|min:1';
            $rules['participants.*'] = 'required|integer|exists:users,id';
        }

        if ($this->filled('lead_id')) {
            $lead = Lead::findOrFail($this->lead_id);
            $rules['lead_id'] = 'required|exists:leads,id';
            $rules['deal_id'] = 'nullable|exists:deals,id';
            $rules['next_follow_up_date'] = 'required|date_format:"d-m-Y"|after_or_equal:'.$lead->created_at->format('d-m-Y');
        } else {
            $deal = Deal::findOrFail($this->deal_id);
            $rules['deal_id'] = 'required|exists:deals,id';
            $rules['next_follow_up_date'] = 'required|date_format:"d-m-Y"|after_or_equal:'.$deal->created_at->format('d-m-Y');
        }

        return $rules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (!$this->filled('lead_id') || !$this->filled('deal_id')) {
                return;
            }

            $dealBelongsToLead = Deal::where('id', $this->deal_id)
                ->where('lead_id', $this->lead_id)
                ->exists();

            if (!$dealBelongsToLead) {
                $validator->errors()->add('deal_id', __('messages.invalidDealForLead'));
            }
        });
    }
}
