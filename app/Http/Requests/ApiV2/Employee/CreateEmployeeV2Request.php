<?php

namespace App\Http\Requests\ApiV2\Employee;

use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Rule;

class CreateEmployeeV2Request extends CoreRequest
{
    public function authorize()
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $companyId = $this->header('X-COMPANY-ID');
        $companyId = $companyId && is_numeric($companyId) ? (int) $companyId : null;
        $phone = $this->input('phone');

        if (is_string($phone)) {
            $normalizedPhone = preg_replace('/[^\d+]/', '', trim($phone));
            if (is_string($normalizedPhone) && $normalizedPhone !== '' && str_starts_with($normalizedPhone, '+')) {
                $phone = '+' . preg_replace('/\D+/', '', substr($normalizedPhone, 1));
            }
        }

        if ($this->has('roleid') && !$this->has('roleId')) {
            $this->merge(['roleId' => $this->input('roleid')]);
        }

        $roleId = $this->input('roleId');
        if (is_string($roleId) && is_numeric($roleId)) {
            $this->merge(['roleId' => (int) $roleId]);
        }

        // Normalize into camelCase input for v2 controller consistency.
        $this->merge([
            'companyId' => $companyId,
            'phone' => $phone,
        ]);
    }

    public function rules()
    {
        $companyId = (int) $this->input('companyId');

        return [
            'firstName' => 'required|string|max:50',
            'lastName' => 'required|string|max:50',
            'email' => [
                'required',
                'email:rfc,strict',
                'max:100',
                Rule::unique('users', 'email')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],

            // Required by spec but ignored by controller.
            'employeeId' => 'required|string|max:100',

            'designationId' => [
                'required',
                'integer',
                Rule::exists('designations', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
            'departmentId' => [
                'required',
                'integer',
                Rule::exists('teams', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],

            'joiningDate' => 'required|date_format:Y-m-d',

            'roleId' => [
                'nullable',
                'integer',
                Rule::exists('roles', 'id')->where(function ($q) use ($companyId) {
                    // Match assignable roles: same company, or legacy rows with null company_id.
                    // Only "client" is blocked (employee API must not assign client role).
                    return $q->where(function ($q2) use ($companyId) {
                        $q2->where('company_id', $companyId);
                        if ($companyId > 0) {
                            $q2->orWhereNull('company_id');
                        }
                    })->where('name', '<>', 'client');
                }),
            ],

            'status' => 'nullable|in:active,inactive',
            'createLeadAgent' => 'nullable|boolean',
            'uplineId' => [
                'nullable',
                'integer',
                Rule::exists('lead_agents', 'id')->where(fn ($q) => $q->where('company_id', $companyId)->whereNull('lead_category_id')),
            ],

            // Optional: presence + non-empty triggers setup email unless sendOnboardingEmail is false.
            'password' => 'nullable|string',
            'sendOnboardingEmail' => 'nullable|boolean',
            'send_onboarding_email' => 'nullable|boolean',
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^\+\d{8,15}$/'],
        ];
    }
}

