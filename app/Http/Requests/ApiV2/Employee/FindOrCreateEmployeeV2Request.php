<?php

namespace App\Http\Requests\ApiV2\Employee;

use App\Http\Requests\CoreRequest;
use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Validation\Rule;

class FindOrCreateEmployeeV2Request extends CoreRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $phone = $this->input('phone');

        if (is_string($phone)) {
            $normalizedPhone = preg_replace('/[^\d+]/', '', trim($phone));
            if (is_string($normalizedPhone) && $normalizedPhone !== '' && str_starts_with($normalizedPhone, '+')) {
                $phone = '+' . preg_replace('/\D+/', '', substr($normalizedPhone, 1));
            }
        }

        $companyId = $this->companyIdFromHeader();
        $existingUserId = null;
        $email = $this->input('email');
        if (is_string($email) && $email !== '') {
            $existingUserId = User::withoutGlobalScope(ActiveScope::class)
                ->where('company_id', $companyId)
                ->where('email', $email)
                ->value('id');
        }

        $payload = $this->all();
        if (!array_key_exists('joiningDate', $payload) || $payload['joiningDate'] === null) {
            $joiningDate = now()->format('Y-m-d');
        } elseif (is_string($payload['joiningDate'])) {
            $joiningDate = trim($payload['joiningDate']);
        } else {
            $joiningDate = $payload['joiningDate'];
        }

        if ($this->has('roleid') && !$this->has('roleId')) {
            $this->merge(['roleId' => $this->input('roleid')]);
        }

        $roleId = $this->input('roleId');
        if (is_string($roleId) && is_numeric($roleId)) {
            $this->merge(['roleId' => (int) $roleId]);
        }

        $this->merge([
            'phone' => $phone,
            'existingUserId' => $existingUserId,
            'joiningDate' => $joiningDate,
        ]);
    }

    public function rules(): array
    {
        $companyId = $this->companyIdFromHeader();
        $existingUserId = $this->input('existingUserId');

        $emailRules = [
            'required',
            'email:rfc,strict',
            'max:100',
        ];
        if ($companyId > 0) {
            $emailUnique = Rule::unique('users', 'email')->where(fn ($q) => $q->where('company_id', $companyId));
            if ($existingUserId) {
                $emailUnique = $emailUnique->ignore($existingUserId);
            }
            $emailRules[] = $emailUnique;
        }

        return [
            'userType' => ['required', 'string', Rule::in(['user', 'employee', 'lead_agent', 'leadAgent'])],

            'firstName' => 'required|string|max:50',
            'lastName' => 'required|string|max:50',
            'email' => $emailRules,

            'employeeId' => 'nullable|string|max:100',

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

            'joiningDate' => ['required', 'date_format:Y-m-d'],

            'roleId' => [
                'nullable',
                'integer',
                Rule::exists('roles', 'id')->where(function ($q) use ($companyId) {
                    return $q->where(function ($q2) use ($companyId) {
                        $q2->where('company_id', $companyId);
                        if ($companyId > 0) {
                            $q2->orWhereNull('company_id');
                        }
                    })->where('name', '<>', 'client');
                }),
            ],

            'status' => ['nullable', 'in:active,inactive'],
            'createLeadAgent' => ['nullable', 'boolean'],
            'uplineId' => [
                'nullable',
                'integer',
                Rule::exists('lead_agents', 'id')->where(fn ($q) => $q->where('company_id', $companyId)->whereNull('lead_category_id')),
            ],

            'password' => ['nullable', 'string'],
            'sendOnboardingEmail' => ['nullable', 'boolean'],
            'send_onboarding_email' => ['nullable', 'boolean'],
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^\+\d{8,15}$/'],
        ];
    }

    /**
     * Company context from X-COMPANY-ID only (set by ApiTokenAuth on v2); not read from JSON body.
     */
    public function resolvedCompanyId(): int
    {
        return $this->companyIdFromHeader();
    }

    private function companyIdFromHeader(): int
    {
        $header = $this->header('X-COMPANY-ID');
        if ($header !== null && $header !== '' && is_numeric($header)) {
            $id = (int) $header;
            if ($id > 0) {
                return $id;
            }
        }

        return 1;
    }
}
