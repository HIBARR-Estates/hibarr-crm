<?php

namespace Modules\Performance\Http\Controllers;

use App\Helper\Reply;
use App\Models\Role;
use Modules\Performance\Entities\GoalType;
use App\Http\Controllers\AccountBaseController;
use Modules\Performance\Entities\PerformanceSetting;
use Modules\Performance\Http\Requests\CreateGoalTypeRequest;

class GoalTypeController extends AccountBaseController
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
     * Show the form for editing the specified resource.
     */
    public function edit($id)
    {
        $this->goalType = GoalType::findOrFail($id);
        $this->roles = Role::whereNotIn('name', ['admin', 'client'])->get();
        $this->goalType->view_by_roles = json_decode($this->goalType->view_by_roles) ?? [];
        $this->goalType->manage_by_roles = json_decode($this->goalType->manage_by_roles) ?? [];

        return view('performance::performance-settings.edit-goal-type-settings', $this->data);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(CreateGoalTypeRequest $request, $id)
    {
        $goalType = GoalType::findOrFail($id);

        $goalType->type = $request->type;
        $goalType->view_by_owner = $request->view_by_owner ? 1 : 0;
        $goalType->view_by_manager = $request->view_by_manager ? 1 : 0;
        $goalType->view_by_roles = json_encode($request->view_by_roles ?? []);
        $goalType->manage_by_owner = $request->manage_by_owner ? 1 : 0;
        $goalType->manage_by_manager = $request->manage_by_manager ? 1 : 0;
        $goalType->manage_by_roles = json_encode($request->manage_by_roles ?? []);
        $goalType->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $goalType = GoalType::findOrFail($id);

        if ($goalType) {
            $goalType->delete();
            return Reply::success(__('messages.deleteSuccess'));
        }

        return Reply::error(__('performance::messages.goalTypeNotFound'));
    }
}
