<?php

namespace App\DataTables;

use App\Models\Developer;
use Yajra\DataTables\Html\Button;
use Yajra\DataTables\Html\Column;

class DevelopersDataTable extends BaseDataTable
{
    private $viewDeveloperPermission;
    private $editDeveloperPermission;
    private $deleteDeveloperPermission;

    public function __construct()
    {
        parent::__construct();
        $this->viewDeveloperPermission = user()->permission('view_developers');
        $this->editDeveloperPermission = user()->permission('edit_developers');
        $this->deleteDeveloperPermission = user()->permission('delete_developers');
    }

    public function dataTable($query)
    {
        $datatables = datatables()->eloquent($query);

        $datatables->addColumn('action', function ($row) {
            $action = '<div class="task_view">';
            
            // View action (all roles can view based on their permission level)
            if ($this->canViewDeveloper($row)) {
                $action .= '<a href="' . route('developers.show', [$row->id]) . '"
                    class="taskView text-darkest-grey f-w-500">' . __('app.view') . '</a>';
            }

            $action .= '<div class="dropdown">
                <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" type="link"
                    id="dropdownMenuLink-' . $row->id . '" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                    <i class="icon-options-vertical icons"></i>
                </a>
                <div class="dropdown-menu dropdown-menu-right" aria-labelledby="dropdownMenuLink-' . $row->id . '" tabindex="0">';

            // Edit action
            if ($this->canEditDeveloper($row)) {
                $action .= '<a class="dropdown-item" href="' . route('developers.edit', [$row->id]) . '">
                    <i class="fa fa-edit mr-2"></i>' . __('app.edit') . '</a>';
            }

            // Delete action (Media Team cannot delete)
            if ($this->canDeleteDeveloper($row)) {
                $action .= '<a class="dropdown-item delete-table-row" href="javascript:;" data-developer-id="' . $row->id . '">
                    <i class="fa fa-trash mr-2"></i>' . __('app.delete') . '</a>';
            }

            $action .= '</div></div></div>';

            return $action;
        });

        $datatables->editColumn('name', function ($row) {
            return '<a href="' . route('developers.show', [$row->id]) . '" class="text-darkest-grey">' . $row->name . '</a>';
        });

        $datatables->rawColumns(['action', 'name']);

        return $datatables;
    }

    public function query(Developer $model)
    {
        $query = $model->newQuery()->select('developers.*');

        // Apply permission-based filtering
        switch ($this->viewDeveloperPermission) {
            case 'all':
                // Sales Manager, Media Team Lead can see all
                break;
            case 'added':
                // Media Team can only see their own records
                $query->where('developers.added_by', user()->id);
                break;
            case 'owned':
                // If you have assignment logic
                $query->where('developers.assigned_to', user()->id);
                break;
            case 'both':
                $query->where(function($q) {
                    $q->where('developers.added_by', user()->id)
                      ->orWhere('developers.assigned_to', user()->id);
                });
                break;
            default:
                // Sales Agents with 'none' permission see nothing
                $query->whereRaw('1 = 0');
                break;
        }

        return $query;
    }

    // Permission check methods
    private function canViewDeveloper($developer)
    {
        switch ($this->viewDeveloperPermission) {
            case 'all':
                return true;
            case 'added':
                return $developer->added_by == user()->id;
            case 'owned':
                return $developer->assigned_to == user()->id;
            case 'both':
                return $developer->added_by == user()->id || $developer->assigned_to == user()->id;
            default:
                return false;
        }
    }

    private function canEditDeveloper($developer)
    {
        switch ($this->editDeveloperPermission) {
            case 'all':
                return true;
            case 'added':
                return $developer->added_by == user()->id;
            case 'owned':
                return $developer->assigned_to == user()->id;
            case 'both':
                return $developer->added_by == user()->id || $developer->assigned_to == user()->id;
            default:
                return false;
        }
    }

    private function canDeleteDeveloper($developer)
    {
        switch ($this->deleteDeveloperPermission) {
            case 'all':
                return true;
            case 'added':
                return $developer->added_by == user()->id;
            default:
                return false; // Media Team cannot delete
        }
    }

    protected function getColumns()
    {
        return [
            __('app.id') => ['data' => 'id', 'name' => 'id', 'title' => __('app.id')],
            __('app.name') => ['data' => 'name', 'name' => 'name', 'title' => __('app.name')],
            __('app.description') => ['data' => 'description', 'name' => 'description', 'title' => __('app.description')],
            Column::computed('action', __('app.action'))
                ->exportable(false)
                ->printable(false)
                ->orderable(false)
                ->searchable(false)
        ];
    }
}