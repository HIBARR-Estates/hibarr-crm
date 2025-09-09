<?php

namespace Modules\Performance\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use Modules\Performance\Entities\KeyResultsMetrics;
use Modules\Performance\Entities\PerformanceSetting;
use Modules\Performance\Http\Requests\CreteKeyResultsRequest;

class KeyResultsMetricsController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();

        $this->activeSettingMenu = 'performance_settings';

        $this->middleware(function ($request, $next) {
            abort_403(!in_array(PerformanceSetting::MODULE_NAME, $this->user->modules) && user()->permission('manage_performance_setting') != 'all');
            return $next($request);
        });
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return view('performance::performance-settings.create-key-results-metrics');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(CreteKeyResultsRequest $request)
    {
        $keyResults = new KeyResultsMetrics();
        $keyResults->company_id = company()->id;
        $keyResults->name = $request->name;
        $keyResults->save();

        return Reply::success(__('messages.recordSaved'));
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        $this->keyResults = KeyResultsMetrics::findOrFail($id);
        return view('performance::performance-settings.edit-key-results-metrcis', $this->data);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(CreteKeyResultsRequest $request, $id)
    {
        $keyResults = KeyResultsMetrics::findOrFail($id);
        $keyResults->name = $request->name;
        $keyResults->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $keyResult = KeyResultsMetrics::findOrFail($id);

        if ($keyResult) {
            $keyResult->delete();
            return Reply::success(__('messages.deleteSuccess'));
        }

        return Reply::error(__('performance::messages.keyResultsNotFound'));
    }

}
