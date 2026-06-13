<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\LeadSetting\UpdateLeadLifecycleStatus;
use App\Models\LeadLifecycleStatus;
use App\Services\LeadLifecycleStatusService;

class LeadLifecycleStatusSettingController extends AccountBaseController
{
    public function __construct(
        private readonly LeadLifecycleStatusService $lifecycleStatusService,
    ) {
        parent::__construct();
        $this->middleware(function ($request, $next) {
            abort_403(!(user()->permission('manage_lead_setting') == 'all' && in_array('leads', user_modules())));

            return $next($request);
        });
    }

    public function edit(int $id)
    {
        $this->lifecycleStatus = LeadLifecycleStatus::withCount('leads')->findOrFail($id);

        return view('lead-settings.edit-lifecycle-modal', $this->data);
    }

    public function update(UpdateLeadLifecycleStatus $request, int $id)
    {
        $status = LeadLifecycleStatus::findOrFail($id);

        $this->lifecycleStatusService->update($status, $request->validated());

        return Reply::success(__('messages.updateSuccess'));
    }
}
