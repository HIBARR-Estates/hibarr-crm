<?php

namespace App\Http\Requests\ApiV2\CrmWrite;

use App\Http\Requests\CoreRequest;
use DateTimeZone;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateMeetingV2Request extends CoreRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $companyId = $this->header('X-COMPANY-ID');
        $companyId = $companyId && is_numeric($companyId) ? (int) $companyId : null;
        $this->merge(['companyId' => $companyId]);
    }

    public function rules(): array
    {
        $rules = [
            'scheduled_at' => 'sometimes|required|date',
            'remark' => 'nullable|string',
            'meeting_type_id' => 'nullable|integer|exists:meeting_types,id',
            'location' => 'sometimes|required|in:office,zoom,zoho,zoho_meet,google_meet,teams,meet,phone,physical,skype,other',
            'meeting_link' => 'nullable|url',
            'duration' => 'nullable|integer|min:1|max:600',
            'status' => 'nullable|string|max:50',
            'reminders' => 'nullable|array',
            'reminders.*.time' => 'required_with:reminders|integer|min:1|max:1440',
            'reminders.*.type' => 'required_with:reminders|in:minute,hour,day',
            'participants' => 'nullable|array',
            'participants.*' => 'required_with:participants|integer|exists:users,id',
            'timezone' => [
                'nullable',
                'string',
                Rule::in(DateTimeZone::listIdentifiers()),
            ],
            'updated_by_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('company_id', (int) $this->input('companyId'))),
            ],
        ];

        $location = $this->input('location');
        if ($location !== null && !in_array($location, ['zoho', 'office', 'phone', 'physical'], true)) {
            $rules['meeting_link'] = 'required|url';
        }

        if ($location === 'zoho') {
            $rules['participants'] = 'required|array|min:1';
            $rules['participants.*'] = 'required|integer|exists:users,id';
        }

        return $rules;
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            if (!$this->has('location')) {
                return;
            }

            $location = $this->input('location');
            if (in_array($location, ['zoho', 'office', 'phone', 'physical'], true)) {
                return;
            }

            if (empty($this->input('meeting_link'))) {
                $validator->errors()->add('meeting_link', __('validation.required', ['attribute' => 'meeting_link']));
            }
        });
    }
}
