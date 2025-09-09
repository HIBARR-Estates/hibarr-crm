<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use App\Models\Company;
use App\Models\User;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeMonthlySalary extends BaseModel
{
    protected $guarded = ['id'];

    protected $dates = ['date'];

    public static function employeeNetSalary($userId, $tillDate = null)
    {
        $initialSalary = EmployeeMonthlySalary::where('user_id', $userId)
            ->where('type', '=', 'initial')
            ->sum('amount');

        $addSalary = EmployeeMonthlySalary::where('user_id', $userId)
            ->where('type', '=', 'increment');

        if (! is_null($tillDate)) {
            $addSalary = $addSalary->where('date', '<=', $tillDate);
        }

        $addSalary = $addSalary->sum('amount');

        $subtractSalary = EmployeeMonthlySalary::where('user_id', $userId)
            ->where('type', '=', 'decrement');

        if (! is_null($tillDate)) {
            $subtractSalary = $subtractSalary->where('date', '<=', $tillDate);
        }

        $subtractSalary = $subtractSalary->sum('amount');

        $netSalary = ($initialSalary + $addSalary - $subtractSalary);

        if ($netSalary < 0) {
            $netSalary = 0;
        }

        return [
            'netSalary' => $netSalary,
            'initialSalary' => $initialSalary,
        ];
    }

    public static function employeeIncrements($userId)
    {
        return EmployeeMonthlySalary::where('user_id', $userId)
            ->where('type', '=', 'increment')
            ->get();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

}
