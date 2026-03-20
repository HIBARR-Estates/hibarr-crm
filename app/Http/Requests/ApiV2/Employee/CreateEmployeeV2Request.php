<?php

namespace App\Http\Requests\ApiV2\Employee;

use App\Http\Requests\CoreRequest;
use App\Models\Company;
use Carbon\Carbon;
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

        // Normalize into camelCase input for v2 controller consistency.
        $this->merge([
            'companyId' => $companyId,
        ]);
    }

    public function rules()
    {
        $companyId = (int) $this->input('companyId');
        $company = $companyId ? Company::find($companyId) : null;

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

            'status' => 'nullable|in:active,inactive',

            // Optional: ignored. We always send "set password" email.
            'password' => 'nullable|string',
        ];
    }
}

