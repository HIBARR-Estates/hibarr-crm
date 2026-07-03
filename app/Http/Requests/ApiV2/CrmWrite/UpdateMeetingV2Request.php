<?php

namespace App\Http\Requests\ApiV2\CrmWrite;

use App\Http\Requests\ApiV2\CrmWrite\Concerns\ValidatesCrmWriteTargets;
use App\Http\Requests\ApiV2\CrmWrite\Concerns\ValidatesMeetingLocationRules;
use App\Http\Requests\CoreRequest;
use DateTimeZone;
use Illuminate\Validation\Rule;

class UpdateMeetingV2Request extends CoreRequest
{
    use ValidatesCrmWriteTargets;
    use ValidatesMeetingLocationRules;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->prepareCrmWriteTargetValidation();
    }

    public function rules(): array
    {
        $companyId = (int) $this->input('companyId');
        $location = $this->has('location') ? $this->input('location') : null;

        $rules = [
            'scheduled_at' => 'sometimes|required|date',
            'remark' => 'nullable|string',
            'meeting_type_id' => $this->meetingTypeIdRule($companyId),
            'location' => 'sometimes|required|in:office,zoom,zoho,zoho_meet,google_meet,teams,meet,phone,physical,skype,other',
            'meeting_link' => 'nullable|url',
            'duration' => 'nullable|integer|min:1|max:600',
            'status' => 'nullable|string|max:50',
            'reminders' => 'nullable|array',
            'reminders.*.time' => 'required_with:reminders|integer|min:1|max:1440',
            'reminders.*.type' => 'required_with:reminders|in:minute,hour,day',
            'participants' => 'nullable|array',
            'participants.*' => $this->participantUserRule($companyId),
            'timezone' => [
                'nullable',
                'string',
                Rule::in(DateTimeZone::listIdentifiers()),
            ],
            'updated_by_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
        ];

        return array_merge($rules, $this->meetingLocationRules($location, true, $companyId));
    }
}
