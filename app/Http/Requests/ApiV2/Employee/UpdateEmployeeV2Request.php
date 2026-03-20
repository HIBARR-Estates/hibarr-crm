<?php

namespace App\Http\Requests\ApiV2\Employee;

use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Rule;

class UpdateEmployeeV2Request extends CoreRequest
{
    public function authorize()
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $companyId = $this->header('X-COMPANY-ID');
        $companyId = $companyId && is_numeric($companyId) ? (int) $companyId : null;

        $this->merge([
            'companyId' => $companyId,
        ]);

        // Accept both `status` and `statusFilter` with the same values.
        if ($this->has('status') && is_string($this->input('status'))) {
            $this->merge(['status' => strtolower(trim($this->input('status')))]);
        }

        if ($this->has('statusFilter') && is_string($this->input('statusFilter'))) {
            $this->merge(['statusFilter' => strtolower(trim($this->input('statusFilter')))]);
        }
    }

    public function rules()
    {
        $companyId = (int) $this->input('companyId');

        $routeUserId = $this->route('userId');
        $routeUserId = $routeUserId && is_numeric($routeUserId) ? (int) $routeUserId : null;

        return [
            'firstName' => 'nullable|string|max:50',
            'lastName' => 'nullable|string|max:50',

            'email' => [
                'nullable',
                'email:rfc,strict',
                'max:100',
                Rule::unique('users', 'email')
                    ->where(fn ($q) => $q->where('company_id', $companyId))
                    ->ignore($routeUserId, 'id'),
            ],

            // Spec includes employeeId, but it's ignored by the controller.
            'employeeId' => 'nullable|string|max:100',

            'designationId' => [
                'nullable',
                'integer',
                Rule::exists('designations', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
            'departmentId' => [
                'nullable',
                'integer',
                Rule::exists('teams', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],

            'joiningDate' => 'nullable|date_format:Y-m-d',

            'status' => 'nullable|in:active,inactive',
            'statusFilter' => 'nullable|in:active,inactive',
            'createLeadAgent' => 'nullable|boolean',
            'uplineId' => [
                'nullable',
                'integer',
                Rule::exists('lead_agents', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],

            // ignored
            'password' => 'nullable|string',
        ];
    }
}

