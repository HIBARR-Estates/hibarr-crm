<?php

namespace Modules\Payroll\Http\Requests\API\Payroll;

use Modules\RestAPI\Http\Requests\BaseRequest;

class IndexRequest extends BaseRequest
{
    public function authorize()
    {

        $user = api_user();

        // Admin can view the estimates
        // Or Client with his/her estimates
        // Or User who has role other than employee and have permission of view_estimates
        return in_array('payroll', $user->modules)
            && (
                $user->hasRole('admin')
                || $user->cans('view_payroll')
            );
    }

    public function rules()
    {
        return [
            //
        ];
    }
}
