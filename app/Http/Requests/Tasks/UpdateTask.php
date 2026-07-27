<?php

namespace App\Http\Requests\Tasks;

use Carbon\Carbon;
use App\Models\Task;
use App\Models\Project;
use App\Models\ProjectMilestone;
use App\Http\Requests\CoreRequest;
use App\Models\TaskSetting;
use App\Traits\CustomFieldsRequestTrait;
use App\Services\TaskService;

class UpdateTask extends CoreRequest
{
    use CustomFieldsRequestTrait;

    protected function prepareForValidation()
    {
        $assigneeIds = TaskService::normalizeAssigneeIds($this->all());
        if (!is_null($assigneeIds)) {
            $this->merge(['user_id' => $assigneeIds]);
        }
    }

    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        $id = $this->route('task');
        $project = request('project_id') ? Project::findOrFail(request('project_id')) : null;

        if(!is_null($this->milestone_id))
        {
            $milestone = ProjectMilestone::findOrFail($this->milestone_id);
            $milestoneEndDate = Carbon::parse($milestone->end_date);
        }
        else
        {
            $milestoneEndDate = null;
        }


        $setting = company();
        $taskSetting = TaskSetting::first();
        $unassignedPermission = user()->permission('create_unassigned_tasks');

        $user = user();
        $rules = [
            'heading' => 'required',
            'start_date' => 'required|date_format:"' . $setting->date_format . ' ' . $setting->time_format . '"',
            'priority' => 'required'
        ];

        if(in_array('client', user_roles()) || $taskSetting->project_required == 'yes')
        {
            $rules['project_id'] = 'required';
        }

        if(!$this->has('without_duedate'))
        {
            if(is_null($milestoneEndDate))
            {
                $rules['due_date'] = 'required|date_format:"' . $setting->date_format . ' ' . $setting->time_format . '"|after_or_equal:start_date';
            }
            else
            {
                $rules['due_date'] = 'required|date_format:"' . $setting->date_format . ' ' . $setting->time_format . '"|after_or_equal:start_date|before_or_equal:'.$milestoneEndDate->format($setting->date_format . ' ' . $setting->time_format);
            }
        }


        if (request()->has('project_id') && request()->project_id != 'all' && request()->project_id != '') {
            $project = Project::findOrFail(request()->project_id);
            $startDate = $project->start_date->format($setting->date_format . ' ' . $setting->time_format);
            $rules['start_date'] = 'required|date_format:"' . $setting->date_format . ' ' . $setting->time_format . '"|after_or_equal:' . $startDate;
        }
        else {
            $rules['start_date'] = 'required|date_format:"' . $setting->date_format . ' ' . $setting->time_format . '"';
        }

        if ($this->has('dependent') && $this->dependent_task_id != '') {
            $dependentTask = Task::findOrFail($this->dependent_task_id);
            $rules['start_date'] = 'required|date_format:"' . $setting->date_format . ' ' . $setting->time_format . '"|after_or_equal:"' . $dependentTask->due_date->format($setting->date_format . ' ' . $setting->time_format) . '"';
        }

        $rules['user_id.0'] = 'required_with:is_private';

        if ($unassignedPermission != 'all') {
            $rules['user_id.0'] = 'required';
        }

        $rules['dependent_task_id'] = 'required_with:dependent';

        if ($this->has('repeat')) {
            $rules['repeat_cycles'] = 'required|integer|min:1';
            $rules['repeat_count'] = 'required|numeric';
        }

        if ($this->has('set_time_estimate')) {
            $rules['estimate_hours'] = 'required|integer|min:0';
            $rules['estimate_minutes'] = 'required|integer|min:0';
        }

        // date_format alone accepts any syntactically valid date (e.g. a typo'd
        // year like 1220), so bound both dates to a sane window around today.
        $dateBoundsRule = function ($attribute, $value, $fail) use ($setting) {
            if (!is_string($value) || $value === '') {
                return;
            }
            $parsed = \DateTime::createFromFormat($setting->date_format . ' ' . $setting->time_format, $value);
            if ($parsed && ((int) $parsed->format('Y') < now()->year - 10 || (int) $parsed->format('Y') > now()->year + 10)) {
                $fail(__('messages.taskDateOutOfRange'));
            }
        };
        $rules['start_date'] = array_merge(explode('|', $rules['start_date']), [$dateBoundsRule]);
        if (isset($rules['due_date'])) {
            $rules['due_date'] = array_merge(explode('|', $rules['due_date']), [$dateBoundsRule]);
        }

        $rules = $this->customFieldRules($rules);

        return $rules;
    }

    public function messages()
    {
        return [
            'project_id.required' => __('messages.chooseProject'),
            'due_date.after_or_equal' => __('messages.taskAfterDateValidation'),
            'due_date.before_or_equal' => __('messages.taskBeforeDateValidation')
        ];
    }

    public function attributes()
    {
        $attributes = [
            'user_id.0' => __('modules.tasks.assignTo'),
            'dependent_task_id' => __('modules.tasks.dependentTask')
        ];

        $attributes = $this->customFieldsAttributes($attributes);

        return $attributes;
    }

}
