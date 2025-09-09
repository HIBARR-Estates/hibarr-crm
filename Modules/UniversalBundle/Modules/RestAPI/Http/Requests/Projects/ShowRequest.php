<?php

namespace Modules\RestAPI\Http\Requests\Projects;

use Modules\RestAPI\Entities\Project;
use Modules\RestAPI\Http\Requests\BaseRequest;

class ShowRequest extends BaseRequest
{
    /**
     * @return bool
     *
     * @throws \Froiden\RestAPI\Exceptions\UnauthorizedException
     */
    public function authorize()
    {
        $user = api_user();
        // Either user has role admin or has permission view_projects
        // Plus he needs to have projects module enabled from settings
        $project = Project::find($this->route('project'));
//        dd(in_array('projects', $user->modules) && $project && $project->visibleTo($user));
        return in_array('projects', $user->modules) && $project && $project->visibleTo($user);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [

        ];
    }
}
