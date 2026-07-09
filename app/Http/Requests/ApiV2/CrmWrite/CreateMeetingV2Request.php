<?php

namespace App\Http\Requests\ApiV2\CrmWrite;

use App\Http\Requests\ApiV2\CrmWrite\Concerns\ValidatesCrmWriteTargets;
use App\Http\Requests\ApiV2\CrmWrite\Concerns\ValidatesMeetingLocationRules;
use App\Http\Requests\CoreRequest;
use DateTimeZone;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class CreateMeetingV2Request extends CoreRequest
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

        $rules = array_merge($this->crmWriteTargetRules(), [
            'scheduled_at' => 'required|date',
            'remark' => 'nullable|string',
            'meeting_type_id' => $this->meetingTypeIdRule($companyId),
            'location' => 'required|in:office,zoom,zoho,zoho_meet,google_meet,teams,meet,phone,physical,skype,other',
            'meeting_link' => 'nullable|url',
            'duration' => 'nullable|integer|min:1|max:600',
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
        ]);

        return array_merge($rules, $this->meetingLocationRules($this->input('location'), false, $companyId));
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $this->validateCrmWriteTargets($validator);
        });
    }
}
