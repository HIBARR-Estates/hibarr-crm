@php
$addProjectMilestonePermission = ($project->project_admin == user()->id) ? 'all' : user()->permission('add_project_milestones');
$viewProjectMilestonePermission = ($project->project_admin == user()->id) ? 'all' : user()->permission('view_project_milestones');
$editProjectMilestonePermission = ($project->project_admin == user()->id) ? 'all' : user()->permission('edit_project_milestones');
$deleteProjectMilestonePermission = ($project->project_admin == user()->id) ? 'all' : user()->permission('delete_project_milestones');
@endphp
<style>
    .danger{
        background-color: rgb(255 180 180 / 32%);
    }
    #project-members-table_wrapper .row {
        align-items: center;
    }
    .dataTables_wrapper  {
        overflow-x:hidden !important;
        overflow-y:auto !important;
    }
</style>
@include('sections.datatable_css')

@if ($viewProjectMilestonePermission == 'all' || $viewProjectMilestonePermission == 'added' || ($viewProjectMilestonePermission == 'owned' && user()->id == $project->client_id))
<div class="jsDatatable">
    <x-table class="border-0 pb-3 admin-dash-table table-hover" id="milestones-table">
        <x-slot name="thead">
            <th class="pl-20">#</th>
            <th>@lang('modules.projects.milestoneTitle')</th>
            <th>@lang('app.status')</th>
            <th>@lang('app.startDate')</th>
            <th>@lang('app.endDate')</th>
        </x-slot>

        @forelse($project->milestones as $key=>$item)
            @php
                $lateMilestone = !is_null($item->end_date) && $item->end_date->isPast() ? 'danger' : '';
            @endphp
            <tr id="row-{{ $item->id }}" class={{ $lateMilestone }}>
                <td class="pl-20">{{ $key + 1 }}</td>
                <td>
                    <a href="javascript:;" class="milestone-detail text-darkest-grey f-w-500"
                        data-milestone-id="{{ $item->id }}">{{ $item->milestone_title }}</a>
                </td>
                <td>
                    @if ($item->status == 'complete')
                        <i class="fa fa-circle mr-1 text-dark-green f-10"></i>
                        {{ trans('app.' . $item->status) }}
                    @else
                        <i class="fa fa-circle mr-1 text-red f-10"></i>
                        {{ trans('app.' . $item->status) }}
                    @endif
                </td>
                <td>
                    @if (!is_null($item->start_date))
                        {{ $item->start_date->format(company()->date_format) }}
                    @endif
                </td>
                <td>
                    @if (!is_null($item->end_date))
                        {{ $item->end_date->format(company()->date_format) }}
                    @endif
                </td>
            </tr>
        @empty
            <x-cards.no-record-found-list colspan="5"/>
        @endforelse
    </x-table>
</div>
@else
    <x-cards.no-record :message="__('messages.noRecordFound')" icon="flag" />
@endif
<script src="{{ asset('vendor/datatables/jquery.dataTables.min.js') }}"></script>
<script src="{{ asset('vendor/datatables/dataTables.bootstrap4.min.js') }}"></script>
<script>
    $('body').on('click', '.milestone-detail', function() {
        const id = $(this).data('milestone-id');
        let url = "{{ route('milestones.show', ':id') }}";
        url = url.replace(':id', id);
        $(MODAL_XL + ' ' + MODAL_HEADING).html('...');
        $.ajaxModal(MODAL_XL, url);
    });

    $(document).ready(function() {
        $('#milestones-table').DataTable();
    });
</script>
