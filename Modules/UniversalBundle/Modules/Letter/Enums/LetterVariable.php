<?php

namespace Modules\Letter\Enums;

use App\Models\User;
use Illuminate\Support\Carbon;

enum LetterVariable: string
{

    case current_date = '##CURRENT_DATE##';
    case employee_id = '##EMPLOYEE_ID##';
    case employee_name = '##EMPLOYEE_NAME##';
    case employee_address = '##EMPLOYEE_ADDRESS##';
    case employee_joining_date = '##EMPLOYEE_JOINING_DATE##';
    case employee_exit_date = '##EMPLOYEE_EXIT_DATE##';
    case employee_probation_end_date = '##EMPLOYEE_PROBATION_END_DATE##';
    case employee_notice_period_start_date = '##EMPLOYEE_NOTICE_PERIOD_START_DATE##';
    case employee_notice_period_end_date = '##EMPLOYEE_NOTICE_PERIOD_END_DATE##';
    case employee_dob = '##EMPLOYEE_DOB##';
    case employee_department = '##EMPLOYEE_DEPARTMENT##';
    case employee_designation = '##EMPLOYEE_DESIGNATION##';
    case signatory = '##SIGNATORY##';
    case signatory_designation = '##SIGNATORY_DESIGNATION##';
    case signatory_department = '##SIGNATORY_DEPARTMENT##';
    case company_name = '##COMPANY_NAME##';

    public function getValue(User $user)
    {
        $value = match ($this) {
            self::current_date => now()->format(company()->date_format),
            self::employee_id => $user->employeeDetail->employee_id,
            self::employee_name => $user->name,
            self::employee_address => $user->employeeDetail->address,
            self::employee_joining_date => $user->employeeDetail->joining_date->format(company()->date_format),
            self::employee_exit_date => $user->employeeDetail->last_date?->format(company()->date_format),
            self::employee_probation_end_date => $user->employeeDetail->probation_end_date ? Carbon::parse($user->employeeDetail->probation_end_date)->format(company()->date_format) : null,
            self::employee_notice_period_start_date => $user->employeeDetail->notice_period_start_date ? Carbon::parse($user->employeeDetail->notice_period_start_date)->format(company()->date_format) : null,
            self::employee_notice_period_end_date => $user->employeeDetail->notice_period_end_date ? Carbon::parse($user->employeeDetail->notice_period_end_date)->format(company()->date_format) : null,
            self::employee_dob => $user->employeeDetail->date_of_birth?->format(company()->date_format),
            self::employee_department => $user->employeeDetail->department?->team_name,
            self::employee_designation => $user->employeeDetail->designation?->name,
            self::signatory => user()->name,
            self::signatory_designation => user()->employeeDetail->designation?->name,
            self::signatory_department => user()->employeeDetail->department?->team_name,
            self::company_name => $user->company->company_name,
            default => null,
        };

        return $value;
    }

    public static function getMappedValues(User $user)
    {
        $values = [];

        foreach (self::cases() as $case) {
            $values[$case->value] = $case->getValue($user);
        }

        return $values;

    }

}
