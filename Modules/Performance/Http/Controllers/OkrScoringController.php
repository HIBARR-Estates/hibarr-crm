<?php

namespace Modules\Performance\Http\Controllers;

use App\Http\Controllers\AccountBaseController;
use App\Models\EmployeeDetails;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Modules\Performance\Entities\GoalType;
use Modules\Performance\Entities\Objective;
use Modules\Performance\Entities\PerformanceSetting;
use Modules\Performance\Exports\ObjectiveMonthlyReport;

class OkrScoringController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'performance::app.okrScoring';

        $this->middleware(function ($request, $next) {
            abort_403(!in_array(PerformanceSetting::MODULE_NAME, $this->user->modules));
            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $this->monthYear = now()->format('m-Y');
        return view('performance::okr-scoring.index', $this->data);
    }

    public function exportReport(Request $request)
    {
        $startDate = Carbon::parse($request->startDate)->format('Y-m-d');
        $endDate = Carbon::parse($request->endDate)->format('Y-m-d');

        $fileName = __('performance::app.okrSroringReportXlsx', ['startDate' => $startDate, 'endDate' => $endDate]);
        return Excel::download(new ObjectiveMonthlyReport($startDate, $endDate), $fileName);
    }

}
