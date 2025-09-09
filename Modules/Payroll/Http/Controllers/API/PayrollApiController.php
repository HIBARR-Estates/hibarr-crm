<?php

namespace Modules\Payroll\Http\Controllers\API;

use App\Models\EmployeeDetails;
use Carbon\Carbon;
use Froiden\RestAPI\ApiResponse;
use Modules\Payroll\Entities\PayrollCompliance;
use Modules\Payroll\Entities\PayrollSetting;
use Modules\Payroll\Entities\API\SalarySlip;
use Modules\Payroll\Entities\PayrollCycle;
use Modules\Payroll\Http\Requests\API\Payroll\IndexRequest;
use Modules\Payroll\Http\Requests\API\Payroll\ShowRequest;
use Modules\RestAPI\Http\Controllers\ApiBaseController;
use Modules\RestAPI\Http\Requests\ApiRequest;

class PayrollApiController extends ApiBaseController
{
    protected $model = SalarySlip::class;

    protected $indexRequest = IndexRequest::class;
    protected $showRequest = ShowRequest::class;

    public function modifyIndex($query)
    {
        $query->visibility();

        return $query;
    }

    public function getCycle()
    {
        $payrollCycle = PayrollCycle::get()->toArray();

        return ApiResponse::make(null, $payrollCycle, null);
    }

    public function getCycleData($payrollCycleId, $year)
    {
        $payrollCycle = PayrollCycle::find($payrollCycleId);
        $currentDate = now();
        $this->current = 0;

        if ($payrollCycle->cycle == 'weekly') {
            $dateData = [];
            $weeks = 52;
            $carbonFirst = new Carbon('first Monday of January ' . $year);

            for ($i = 1; $i <= $weeks; $i++) {
                $dateData['start_date'][] = $carbonFirst->toDateString();
                $endDate = $carbonFirst->addWeek();
                $dateData['end_date'][] = $endDate->subDay()->toDateString();
                $index = ($i > 1) ? ($i - 1) : 0;
                $startDateData = Carbon::parse($dateData['start_date'][$index]);

                if ($currentDate->between($startDateData, $endDate)) {
                    $this->current = $index;
                }

                $carbonFirst = $endDate->addDay();
            }

            return ApiResponse::make(null, $dateData);
        }

        if ($payrollCycle->cycle == 'biweekly') {

            $dateData = [];
            $weeks = 26;
            $carbonFirst = new Carbon('first Monday of January ' . $year);

            $this->current = 0;
            $index = 0;

            for ($i = 1; $i <= $weeks; $i++) {
                $dateData['start_date'][] = $carbonFirst->format('Y-m-d');
                $endDate = $carbonFirst->addWeeks(2);
                $dateData['end_date'][] = $endDate->subDay()->toDateString();
                $index = ($i > 1) ? ($i - 1) : 0;
                $startDateData = Carbon::parse($dateData['start_date'][$index]);

                if ($currentDate->between($startDateData, $endDate)) {
                    $this->current = $index;
                }

                $carbonFirst = $endDate->addDay();
            }

            return ApiResponse::make(null, $dateData);
        }

        if ($payrollCycle->cycle == 'semimonthly') {
            $startDay = 1;
            $endDay = 15;
            $startSecondDay = 16;
            $endSecondDay = 30;
            $dateData = [];
            $months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
            $i = 0;

            foreach ($months as $index => $month) {
                $date = Carbon::createFromDate($year, $month);
                $daysInMonth = $date->daysInMonth;

                $dateData['start_date'][] = $startDateData = Carbon::createFromDate($year, $month, $startDay)->toDateString();

                $dateData['end_date'][] = $endDateData = Carbon::createFromDate($year, $month, $endDay)->toDateString();

                if ($currentDate->between($startDateData, $endDateData)) {
                    $this->current = $i;
                }

                $i++;
                $dateData['start_date'][] = $startDateDataNew = Carbon::createFromDate($year, $month, $startSecondDay)->toDateString();

                if ($endSecondDay > $daysInMonth) {
                    $dateData['end_date'][] = $endDateDataNew = Carbon::createFromDate($year, $month, $daysInMonth)->toDateString();
                }
                else {
                    $dateData['end_date'][] = $endDateDataNew = Carbon::createFromDate($year, $month, $endSecondDay)->toDateString();
                }

                if ($currentDate->between($startDateDataNew, $endDateDataNew)) {
                    $this->current = $i;
                }

                $i++;
            }

            return ApiResponse::make(null, $dateData);
        }

        if ($payrollCycle->cycle == 'monthly') {
            $this->months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
            $dateData = [];
            $months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

            foreach ($months as $month) {
                $date = Carbon::createFromDate($year, $month);
                $dateData['start_date'][] = Carbon::parse(Carbon::parse('01-' . $month . '-' . $year))->startOfMonth()->toDateString();
                $dateData['end_date'][] = Carbon::parse(Carbon::parse('01-' . $month . '-' . $year))->endOfMonth()->toDateString();
            }

            return ApiResponse::make(null, $dateData);
        }
    }

}

