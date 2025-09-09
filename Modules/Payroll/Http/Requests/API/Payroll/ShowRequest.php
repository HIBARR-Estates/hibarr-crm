<?php

namespace Modules\Payroll\Http\Requests\API\Payroll;

use Modules\Payroll\Entities\API\SalarySlip as APISalarySlip;
use Modules\RestAPI\Http\Requests\BaseRequest;

class ShowRequest extends BaseRequest
{
    public function authorize()
    {
        $user = api_user();
        $salarySlip = APISalarySlip::find($this->route('salary_slip'));

        // Admin can show all estimates
        // Or Client which for whose estimates created
        // Or User who has role other than employee and have permission of view_estimates
        return in_array('payroll', $user->modules) && $salarySlip && $salarySlip->visibleTo($user);
    }

    public function rules()
    {
        return [
            //
        ];
    }
}
