<?php

namespace App\DataTables;

use App\Helper\Common;
use App\Models\Project;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\GlobalSetting;
use App\Models\ProjectStatusSetting;
use Yajra\DataTables\Html\Button;
use Yajra\DataTables\Html\Column;
use Illuminate\Support\Facades\DB;
use App\Helper\UserService;
use App\Models\ClientContact;

class ProjectsDataTable extends BaseDataTable
{

    private $addProjectPermission;
    private $editProjectsPermission;
    private $deleteProjectPermission;
    private $viewProjectPermission;
    private $viewGanttPermission;
    private $addProjectMemberPermission;

    public function __construct()
    {
        parent::__construct();
        $this->addProjectPermission = user()->permission('add_projects');
        $this->editProjectsPermission = user()->permission('edit_projects');
        $this->deleteProjectPermission = user()->permission('delete_projects');
        $this->viewProjectPermission = user()->permission('view_projects');
        $this->viewGanttPermission = user()->permission('view_project_gantt_chart');
        $this->addProjectMemberPermission = user()->permission('add_project_members');
    }

    /**
     * Build DataTable class.
     *
     * @param mixed $query Results from query() method.
     * @return \Yajra\DataTables\DataTableAbstract
     */
    public function dataTable($query)
    {
        $projectStatus = ProjectStatusSetting::get();
        $userId = UserService::getUserId();
        $clientIds = ClientContact::where('user_id', $userId)->pluck('client_id')->toArray();

        $datatables = datatables()->eloquent($query);
        $datatables->addIndexColumn();

        $datatables->addColumn('check', fn($row) => $this->checkBox($row));
        $datatables->addColumn(
            'action',
            function ($row) use ($userId) {
                $memberIds = $row->members->pluck('user_id')->toArray();

                $action = '<div class="task_view">

                <div class="dropdown">
                    <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" type="link"
                        id="dropdownMenuLink-' . $row->id . '" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                        <i class="icon-options-vertical icons"></i>
                    </a>
                    <div class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuLink-' . $row->id . '" tabindex="0">';

                $action .= '<a href="' . route('projects.show', [$row->id]) . '" class="dropdown-item"><i class="mr-2 fa fa-eye"></i>' . __('app.view') . '</a>';

                if (
                    $this->editProjectsPermission == 'all'
                    || ($this->editProjectsPermission == 'added' && (user()->id == $row->added_by || $userId == $row->added_by))
                    || ($this->editProjectsPermission == 'owned' && $userId == $row->client_id && in_array('client', user_roles()))
                    || ($this->editProjectsPermission == 'owned' && in_array(user()->id, $memberIds) && in_array('employee', user_roles()))
                    || ($this->editProjectsPermission == 'both' && ($userId == $row->client_id || user()->id == $row->added_by || $userId == $row->added_by))
                    || ($this->editProjectsPermission == 'both' && in_array(user()->id, $memberIds) && in_array('employee', user_roles()))
                ) {
                    $action .= '<a class="dropdown-item openRightModal" href="' . route('projects.edit', [$row->id]) . '">
                            <i class="mr-2 fa fa-edit"></i>
                            ' . trans('app.edit') . '
                        </a>';
                }

                if ($this->addProjectPermission == 'all' || $this->addProjectPermission == 'added' || $this->addProjectPermission == 'both') {
                    $action .= '<a class="dropdown-item duplicateProject" href="javascript:;" data-project-id="' . $row->id . '">
                            <i class="mr-2 fa fa-clone"></i>
                            ' . trans('app.duplicate') . '
                        </a>';
                }

                if ($this->viewGanttPermission == 'all' || ($this->viewGanttPermission == 'added' && user()->id == $row->added_by) || ($this->viewGanttPermission == 'owned' && user()->id == $row->client_id)) {
                    $action .= '<a class="dropdown-item" href="' . route('projects.show', $row->id) . '?tab=gantt' . '">
                            <i class="mr-2 fa fa-project-diagram"></i>
                            ' . trans('modules.projects.viewGanttChart') . '
                        </a>';
                }

                if ($row->public_gantt_chart == 'enable') {
                    $action .= '<a class="dropdown-item" target="_blank" href="' . url()->temporarySignedRoute('front.gantt', now()->addDays(GlobalSetting::SIGNED_ROUTE_EXPIRY), $row->hash) . '">
                        <i class="mr-2 fa fa-share-square"></i>
                        ' . trans('modules.projects.viewPublicGanttChart') . '
                    </a>';
                }

                if ($row->public_taskboard == 'enable') {
                    $action .= '<a class="dropdown-item" target="_blank" href="' . url()->temporarySignedRoute('front.taskboard', now()->addDays(GlobalSetting::SIGNED_ROUTE_EXPIRY), $row->hash) . '">
                        <i class="mr-2 fa fa-share-square"></i>
                        ' . trans('app.public') . ' ' . __('modules.tasks.taskBoard') . '
                    </a>';
                }

                if ($row->pinned_project == 1) {
                    $action .= '<a class="dropdown-item" href="javascript:;" id="pinnedItem" data-project-id="' . $row->id . '"
                                    data-pinned="pinned"><i class="mr-2 fa fa-thumbtack"></i>' . trans('app.unpinProject') . '
                                    </a>';
                } else {
                    $action .= '<a class="dropdown-item" href="javascript:;" id="pinnedItem" data-project-id="' . $row->id . '"
                                    data-pinned="unpinned"><i class="mr-2 fa fa-thumbtack"></i>' . trans('app.pinProject') . '
                                    </a>';
                }

                if (
                    $this->deleteProjectPermission == 'all'
                    || ($this->deleteProjectPermission == 'added' && (user()->id == $row->added_by || $userId == $row->added_by))
                    || ($this->deleteProjectPermission == 'owned' && $userId == $row->client_id && in_array('client', user_roles()))
                    || ($this->deleteProjectPermission == 'owned' && in_array(user()->id, $memberIds) && in_array('employee', user_roles()))
                    || ($this->deleteProjectPermission == 'both' && ($userId == $row->client_id || user()->id == $row->added_by || $userId == $row->added_by))
                    || ($this->deleteProjectPermission == 'both' && in_array(user()->id, $memberIds) && in_array('employee', user_roles()))
                ) {
                    $action .= '<a class="dropdown-item archive" href="javascript:;" data-user-id="' . $row->id . '">
                            <i class="mr-2 fa fa-archive"></i>
                            ' . trans('app.archive') . '
                        </a>';
                    $action .= '<a class="dropdown-item delete-table-row" href="javascript:;" data-user-id="' . $row->id . '">
                            <i class="mr-2 fa fa-trash"></i>
                            ' . trans('app.delete') . '
                        </a>';
                }

                $action .= '</div>
                </div>
            </div>';

                return $action;
            }
        );
        $datatables->addColumn(
            'members',
            function ($row) {
                if ($row->public) {
                    return '--';
                }

                $members = '<div class="position-relative">';

                if (count($row->members) > 0) {
                    foreach ($row->members as $key => $member) {
                        if ($key < 4) {
                            $img = '<img data-toggle="tooltip" height="25" width="25" data-original-title="' . $member->user->name . '" src="' . $member->user->image_url . '">';

                            $position = $key > 0 ? 'position-absolute' : '';
                            $members .= '<div class="taskEmployeeImg rounded-circle ' . $position . '" style="left:  ' . ($key * 13) . 'px"><a href="' . route('employees.show', $member->user->id) . '">' . $img . '</a></div> ';
                        }
                    }
                } else if ($this->addProjectMemberPermission == 'all') {
                    $members .= '<a href="' . route('projects.show', $row->id) . '?tab=members" class="f-12 text-dark-grey"><i class="fa fa-plus" ></i> ' . __('modules.projects.addMemberTitle') . '</a>';
                } else {

                    $members .= '--';
                }

                if (count($row->members) > 4) {
                    $members .= '<div class="text-center taskEmployeeImg more-user-count rounded-circle bg-amt-grey position-absolute" style="left:  52px"><a href="' . route('projects.show', $row->id) . '?tab=members" class="text-dark f-10">+' . (count($row->members) - 4) . '</a></div> ';
                }

                $members .= '</div>';

                return $members;
            }
        );
        $datatables->addColumn('name', function ($row) {
            $members = [];

            if (count($row->members) > 0) {

                foreach ($row->members as $member) {
                    $members[] = $member->user->name;
                }

                return implode(',', $members);
            }
        });
        $datatables->addColumn('project', function ($row) {
            return $row->project_name;
        });

        $datatables->addColumn('project_cat', function ($row) {
            return $row->category->category_name ?? '--';
        });

        $datatables->addColumn('project_dept', function ($row) {

            $dept = [];
            if (count($row->departments) > 0) {
                foreach ($row->departments as $dep) {
                    $dept[] = $dep->department->team_name;
                }
                return implode(', ', $dept);
            }
            return '--';
        });

        $datatables->editColumn('project_name', function ($row) {
            $pin = '';

            if (($row->pinned_project)) {
                $pin .= '<span class="badge badge-secondary"><i class="fa fa-thumbtack"></i> ' . __('app.pinned') . '</span>';
            }

            if (($row->public)) {
                $pin = '<span class="badge badge-primary"><i class="fa fa-globe"></i> ' . __('app.public') . '</span>';
            }

            return '<div class="media align-items-center">
                        <div class="media-body">
                    <h5 class="mb-0 f-13 text-darkest-grey"><a href="' . route('projects.show', [$row->id]) . '">' . $row->project_name . '</a></h5>
                    <p class="mb-0">' . $pin . '</p>
                    </div>
                </div>';
        });
        $datatables->editColumn('start_date', fn($row) => $row->start_date?->translatedFormat($this->company->date_format));

        $datatables->editColumn('deadline', fn($row) => Common::dateColor($row->deadline));

        $datatables->addColumn('client_name', fn($row) => $row->client?->name_salutation ?? '-');
        $datatables->addColumn('client_email', fn($row) => $row->client?->email ?? '-');

        $datatables->addColumn('project_status', fn($row) => ucwords($row->status));
        $datatables->editColumn('client_id', fn($row) => $row->client_id ? view('components.client', ['user' => $row->client]) : '');
        $datatables->addColumn('status', function ($row) use ($projectStatus, $userId, $clientIds) {
            $projectUsers = $row->members->pluck('user_id')->toArray();

            if ($row->completion_percent < 50) {
                $statusColor = 'danger';
            } elseif ($row->completion_percent < 75) {
                $statusColor = 'warning';
            } else {
                $statusColor = 'success';
            }

            $status = '<p><div class="progress" style="height: 15px;">
                <div class="progress-bar f-12 bg-' . $statusColor . '" role="progressbar" style="width: ' . $row->completion_percent . '%;" aria-valuenow="' . $row->completion_percent . '" aria-valuemin="0" aria-valuemax="100">' . $row->completion_percent . '%</div>
              </div></p>';

            if (
                $this->editProjectsPermission == 'all'
                || ($this->editProjectsPermission == 'added' && (user()->id == $row->added_by || $userId == $row->added_by || in_array($row->added_by, $clientIds)))
                || ($this->editProjectsPermission == 'owned' && $userId == $row->client_id && in_array('client', user_roles()))
                || ($this->editProjectsPermission == 'owned' && in_array(user()->id, $projectUsers) && in_array('employee', user_roles()))
                || ($this->editProjectsPermission == 'both' && ($userId == $row->client_id || user()->id == $row->added_by || $userId == $row->added_by || in_array($row->added_by, $clientIds)))
                || ($this->editProjectsPermission == 'both' && in_array(user()->id, $projectUsers) && in_array('employee', user_roles()))
            ) {
                $status .= '<select class="form-control select-picker change-status" data-size="5" data-project-id="' . $row->id . '">';

                foreach ($projectStatus as $item) {
                    $status .= '<option ';

                    if ($item->status_name == $row->status) {
                        $status .= 'selected';
                    }

                    $status .= '  data-content="<i class=\'fa fa-circle mr-2\' style=\'color: ' . $item->color . '\'></i> ' . $item->status_name . '" value="' . $item->status_name . '" >' . $item->status_name . '</option>';
                }

                $status .= '</select>';

                return $status;
            } else {
                foreach ($projectStatus as $item) {
                    if ($row->status == $item->status_name) {
                        // return '<i class="mr-1 fa fa-circle text-yellow"
                        //     style="color: ' . $item->color . '"></i>' . $item->status_name;

                        $status .= '<i class="mr-1 fa fa-circle text-yellow" style="color: ' . $item->color . '"></i>' . $item->status_name;
                        return $status;
                    }
                }
            }
        });
        $datatables->editColumn('completion_percent', function ($row) {
            $completionPercent = $row->completion_percent;
            $statusColor = $completionPercent < 50 ? 'danger' : ($completionPercent < 75 ? 'warning' : 'success');

            return '<div class="progress" style="height: 15px;">
                        <div class="progress-bar f-12 bg-' . $statusColor . '" role="progressbar" style="width: ' . $completionPercent . '%;" aria-valuenow="' . $completionPercent . '" aria-valuemin="0" aria-valuemax="100">' . $completionPercent . '%</div>
                     </div>';
        });
        $datatables->addColumn('completion_export', function ($row) {
            return $row->completion_percent . '% ' . __('app.complete');
        });
        $datatables->setRowId(fn($row) => 'row-' . $row->id);
        $datatables->editColumn('project_short_code', function ($row) {
            return '<a href="' . route('projects.show', [$row->id]) . '" class="text-darkest-grey">' . $row->project_short_code . '</a>';
        });
        $datatables->orderColumn('status', 'status $1');
        $datatables->removeColumn('project_summary');
        $datatables->removeColumn('notes');
        $datatables->removeColumn('category_id');
        $datatables->removeColumn('feedback');
        $datatables->setRowClass(
            function ($row) {
                return $row->pinned_project ? 'alert-primary' : '';
            }
        );

        // Custom Fields For export
        $customFieldColumns = CustomField::customFieldData($datatables, Project::CUSTOM_FIELD_MODEL);

        $datatables->rawColumns(array_merge(['project_name', 'action', 'completion_percent', 'members', 'status', 'client_id', 'check', 'project_short_code', 'deadline'], $customFieldColumns));

        return $datatables;
    }

    /**
     * @param Project $model
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function query(Project $model)
    {
        $request = $this->request();
        $userId = UserService::getUserId();

        $model = $model
            ->with('members', 'members.user', 'client', 'client.clientDetails', 'currency', 'client.session', 'mentionUser', 'client.clientDetails.company:id,company_name', 'departments', 'category', 'departments.department')
            ->leftJoin('project_members', 'project_members.project_id', 'projects.id')
            ->leftJoin('users', 'project_members.user_id', 'users.id')
            ->leftJoin('users as client', 'projects.client_id', 'users.id')
            ->leftJoin('mention_users', 'mention_users.project_id', 'projects.id')
            ->leftJoin('project_departments', 'project_departments.project_id', 'projects.id')
            ->selectRaw(
                'projects.id, projects.public_taskboard, projects.public_gantt_chart, projects.project_short_code, projects.hash, projects.added_by, projects.project_name, projects.start_date, projects.deadline, projects.client_id,
              projects.completion_percent, projects.project_budget, projects.currency_id, projects.category_id,
            projects.status, users.salutation, users.name, client.name as client_name, client.email as client_email, projects.public, mention_users.user_id as mention_user,
           ( select count("id") from pinned where pinned.project_id = projects.id and pinned.user_id = ' . $userId . ') as pinned_project'
            );

        if ($request->pinned == 'pinned') {
            $model->join('pinned', 'pinned.project_id', 'projects.id');
            $model->where('pinned.user_id', $userId);
        }

        if (!is_null($request->status) && $request->status != 'all') {
            if ($request->status == 'overdue') {
                $model->where('projects.completion_percent', '!=', 100);
                $todayDate = now(company()->timezone)->toDateString();

                if ($request->deadLineStartDate == '' && $request->deadLineEndDate == '') {
                    if ($request->startFilterDate == '' && $request->endFilterDate == '') {
                        $model->whereDate('projects.deadline', '<', $todayDate);
                    } else {
                        $startDate = companyToDateString($request->startFilterDate);
                        $endDate = companyToDateString($request->endFilterDate);

                        // Check if today's date is between start date and end date
                        if ($todayDate >= $startDate && $todayDate <= $endDate) {
                            $model->whereRaw('Date(projects.deadline) >= ?', [$startDate])
                                ->whereRaw('Date(projects.deadline) < ?', [$todayDate]);
                        } else {
                            $model->whereRaw('Date(projects.deadline) >= ?', [$startDate])
                                ->whereRaw('Date(projects.deadline) <= ?', [$endDate]);
                        }
                    }
                } else {
                    if ($request->startFilterDate == '' && $request->endFilterDate == '') {
                        $startDate = companyToDateString($request->deadLineStartDate);
                        $endDate = companyToDateString($request->deadLineEndDate);
                    } else {
                        $startDate = companyToDateString($request->startFilterDate);
                        $endDate = companyToDateString($request->endFilterDate);
                    }

                    // Check if today's date is between start date and end date
                    if ($todayDate >= $startDate && $todayDate <= $endDate) {
                        $model->whereRaw('Date(projects.deadline) >= ?', [$startDate])
                            ->whereRaw('Date(projects.deadline) < ?', [$todayDate]);
                    } else {
                        $model->whereRaw('Date(projects.deadline) >= ?', [$startDate])
                            ->whereRaw('Date(projects.deadline) <= ?', [$endDate]);
                    }
                }
            } else {
                $model->where('projects.status', $request->status);
            }
        } else {
            if ($request->startFilterDate !== null && $request->startFilterDate != 'null' && $request->startFilterDate != '') {
                $startFilterDate = companyToDateString($request->startFilterDate);
                $model->where(DB::raw('DATE(projects.`start_date`)'), '>=', $startFilterDate);
            }

            if ($request->endFilterDate !== null && $request->endFilterDate != 'null' && $request->endFilterDate != '') {
                $endFilterDate = companyToDateString($request->endFilterDate);
                $model->where(DB::raw('DATE(projects.`start_date`)'), '<=', $endFilterDate);
            }
        }

        if ($request->progress) {
            $model->where(
                function ($q) use ($request) {
                    foreach ($request->progress as $progress) {
                        $completionPercent = explode('-', $progress);
                        $q->orWhereBetween('projects.completion_percent', [$completionPercent[0], $completionPercent[1]]);
                    }
                }
            );
        }

        if (!is_null($request->client_id) && $request->client_id != 'all') {
            $model->where('projects.client_id', $request->client_id);
        }

        if (!is_null($request->team_id) && $request->team_id != 'all') {
            $model->where(
                function ($query) {
                    return $query->where('project_departments.team_id', request()->team_id);
                }
            );
        }

        if (!is_null($request->category_id) && $request->category_id != 'all') {
            $model->where('category_id', $request->category_id);
        }

        if (!is_null($request->public) && $request->public != 'all') {
            $model->where('public', $request->public);
        }

        if (!is_null($request->employee_id) && $request->employee_id != 'all') {
            $model->where(
                function ($query) {
                    return $query
                        // ->where('projects.added_by', '=', user()->id)
                        ->where('project_members.user_id', request()->employee_id)
                        ->orWhere('mention_users.user_id', user()->id)
                        ->orWhere('projects.public', 1);
                }
            );
        }

        if ($this->viewProjectPermission == 'added') {
            $model->where(
                function ($query) use ($userId) {

                    return $query->where('projects.added_by', $userId)
                        ->orWhere('mention_users.user_id', user()->id)
                        ->orWhere('projects.public', 1);
                }
            );
        }

        if ($this->viewProjectPermission == 'owned' && in_array('employee', user_roles())) {
            $model->where(
                function ($query) {
                    return $query->where('project_members.user_id', user()->id)
                        ->orWhere('mention_users.user_id', user()->id)
                        ->orWhere('projects.public', 1);
                }
            );
        }

        if ($this->viewProjectPermission == 'both' && in_array('employee', user_roles())) {
            $model->where(
                function ($query) {
                    return $query->where('projects.added_by', user()->id)
                        ->orWhere('project_members.user_id', user()->id)
                        ->orWhere('mention_users.user_id', user()->id)
                        ->orWhere('projects.public', 1);
                }
            );
        }

        if ($request->searchText != '') {
            $safeTerm = Common::safeString(request('searchText'));
            $model->where(
                function ($query) use ($safeTerm) {
                    $query->where('projects.project_name', 'like', '%' . $safeTerm . '%')
                        ->orWhere('users.name', 'like', '%' . $safeTerm . '%')
                        ->orWhere('projects.project_short_code', 'like', '%' . $safeTerm . '%'); // project short code
                }
            );
        }

        if ($request->status != 'overdue' && !is_null($request->status) && $request->status != 'all') {
            if ($request->startFilterDate !== null && $request->startFilterDate != 'null' && $request->startFilterDate != '') {
                $startFilterDate = companyToDateString($request->startFilterDate);
                $model->where(DB::raw('DATE(projects.`start_date`)'), '>=', $startFilterDate);
            }

            if ($request->endFilterDate !== null && $request->endFilterDate != 'null' && $request->endFilterDate != '') {
                $endFilterDate = companyToDateString($request->endFilterDate);
                $model->where(DB::raw('DATE(projects.`start_date`)'), '<=', $endFilterDate);
            }
            $model->where('projects.status', $request->status);
        }

        $model->groupBy('projects.id');
        $model->orderByRaw('pinned_project desc');

        // Handle ordering
        $columns = $request->get('columns');
        $order = $request->get('order');
        $model->orderByRaw('pinned_project desc');

        if ($order) {
            foreach ($order as $o) {
                $columnIndex = $o['column'];
                $columnName = $columns[$columnIndex]['data'];
                $direction = $o['dir'];
                $model->orderBy($columnName, $direction);
            }
        } else {
            $model->orderByRaw('projects.start_date desc');
        }

        return $model;
    }

    /**
     * Optional method if you want to use html builder.
     *
     * @return \Yajra\DataTables\Html\Builder
     */
    public function html()
    {
        $dataTable = $this->setBuilder('projects-table', 7)
            ->parameters(
                [
                    'initComplete' => 'function () {
                    window.LaravelDataTables["projects-table"].buttons().container()
                    .appendTo( "#table-actions")
                }',
                    'fnDrawCallback' => 'function( oSettings ) {
                    $("#projects-table .select-picker").selectpicker();

                    $("body").tooltip({
                        selector: \'[data-toggle="tooltip"]\'
                    })
                }',
                ]
            );

        if (canDataTableExport()) {
            $dataTable->buttons(Button::make(['extend' => 'excel', 'text' => '<i class="fa fa-file-export"></i> ' . trans('app.exportExcel')]));
        }

        return $dataTable;
    }

    /**
     * Get columns.
     *
     * @return array
     */
    protected function getColumns()
    {
        $data = [
            'check' => [
                'title' => '<input type="checkbox" name="select_all_table" id="select-all-table" onclick="selectAllTable(this)">',
                'exportable' => false,
                'orderable' => false,
                'searchable' => false,
                'visible' => !in_array('client', user_roles())
            ],
            '#' => ['data' => 'DT_RowIndex', 'orderable' => false, 'searchable' => false, 'visible' => false, 'title' => '#'],
            __('modules.taskCode') => ['data' => 'project_short_code', 'name' => 'project_short_code', 'title' => __('modules.taskCode')],
            __('modules.projects.projectName') => ['data' => 'project_name', 'name' => 'project_name', 'exportable' => false, 'width' => '20%', 'title' => __('modules.projects.projectName')],
            __('app.project') => ['data' => 'project', 'name' => 'project_name', 'visible' => false, 'title' => __('app.project')],
        ];

        if (in_array('client', user_roles())) {
            if (user()->permission('view_project_members') == 'all') {
                $data[__('modules.projects.members')] = ['data' => 'members', 'orderable' => false, 'name' => 'members', 'exportable' => false, 'width' => '15%', 'title' => __('modules.projects.members')];
            }
        } else {
            $data[__('modules.projects.members')] = ['data' => 'members', 'orderable' => false, 'name' => 'members', 'exportable' => false, 'width' => '15%', 'title' => __('modules.projects.members')];
        }

        $data2 = [
            __('modules.projects.projectMembers') => ['data' => 'name', 'orderable' => false, 'name' => 'name', 'visible' => false, 'title' => __('modules.projects.projectMembers')],
            __('modules.projects.startDate') => ['data' => 'start_date', 'name' => 'start_date', 'title' => __('modules.projects.startDate'), 'width' => '12%'],
            __('app.deadline') => ['data' => 'deadline', 'name' => 'deadline', 'title' => __('app.deadline'), 'width' => '12%'],
            __('app.client') => ['data' => 'client_id', 'name' => 'client_id', 'width' => '15%', 'exportable' => false, 'title' => __('app.client'), 'visible' => (!in_array('client', user_roles()) && in_array('clients', user_modules()))]
        ];

        if (in_array('client', user_roles())) {
            $data2[__('app.customers')] = ['data' => 'client_name', 'name' => 'client_id', 'visible' => false, 'title' => __('app.customers')];
            $data2[__('app.client') . ' ' . __('app.email')] = ['data' => 'client_email', 'name' => 'client_id', 'visible' => false, 'title' => __('app.client') . ' ' . __('app.email')];
        } else {
            $data2[__('app.customers')] = ['data' => 'client_name', 'name' => 'client_id', 'exportable' => (in_array('clients', user_modules()) && user()->permission('view_clients') !== 'none'), 'visible' => false, 'title' => __('app.customers')];
            $data2[__('app.client') . ' ' . __('app.email')] = ['data' => 'client_email', 'name' => 'client_id', 'exportable' => (in_array('clients', user_modules()) && user()->permission('view_clients') !== 'none'), 'visible' => false, 'title' => __('app.client') . ' ' . __('app.email')];
        }

        // Hide $data2[__('app.progress')] = ['data' => 'completion_percent', 'name' => 'completion_percent', 'exportable' => false, 'title' => __('app.progress')];
        $data2[__('app.completion')] = ['data' => 'completion_export', 'name' => 'completion_export', 'visible' => false, 'title' => __('app.completion')];
        $data2[__('app.status')] = ['data' => 'status', 'name' => 'status', 'width' => '16%', 'exportable' => false, 'title' => __('app.status')];
        $data2[__('app.project') . ' ' . __('app.status')] = ['data' => 'project_status', 'name' => 'status', 'visible' => false, 'title' => __('app.project') . ' ' . __('app.status')];
        $data2[__('modules.projects.projectCategory')] = ['data' => 'project_cat', 'name' => 'project_cat', 'visible' => false, 'title' => __('modules.projects.projectCategory')];
        $data2[__('app.department')] = ['data' => 'project_dept', 'name' => 'project_dept', 'visible' => false, 'title' => __('app.department')];

        $data = array_merge($data, $data2);

        $action = [
            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->searchable(false)
                ->addClass('text-right pr-20')
        ];

        return array_merge($data, CustomFieldGroup::customFieldsDataMerge(new Project()), $action);
    }
}
