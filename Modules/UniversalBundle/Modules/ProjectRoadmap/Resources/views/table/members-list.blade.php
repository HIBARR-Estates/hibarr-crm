@php
$addProjectMemberPermission = user()->permission('add_project_members');
$viewProjectMemberPermission = user()->permission('view_project_members');
$editProjectMemberPermission = user()->permission('edit_project_members');
$deleteProjectMemberPermission = user()->permission('delete_project_members');
$viewProjectHourlyRatePermission = user()->permission('view_project_hourly_rates');
@endphp
<style>

#milestones-table_wrapper .row{
    align-items: center;
}
.dataTables_wrapper  {
    overflow-x:hidden !important;
    overflow-y:auto !important;
}
</style>

@if ($viewProjectMemberPermission == 'all')
<div class="jsDatatable">
    <x-table class="border-0 pb-3 table-hover overflow-auto" id="project-members-table">
        <x-slot name="thead">
            <th>@lang('app.name')</th>
            <th>@lang('modules.tasks.assigned')</th>
            <th>@lang('app.completed')</th>
            <th>@lang('modules.attendance.late')</th>
            <th>@lang('modules.dashboard.totalHoursLogged')</th>
        </x-slot>

        @forelse($project->members as $key=>$member)
            <tr id="row-{{ $member->id }}">
                <td>
                    <x-employee :user="$member->user" />
                </td>
                <td>
                    {{ $taskCounts[$member->user_id] ?? 0 }}
                </td>
                <td>
                    {{ $completedTaskCounts[$member->user_id] ?? 0 }}
                </td>
                <td>
                    {{ $lateTaskCounts[$member->user_id] ?? 0 }}
                </td>
                <td>
                    {{ $totalHours[$member->user_id] ?? 0 }}
                </td>
            </tr>
        @empty
            <tr>
                <td colspan="5">
                    <x-cards.no-record icon="user" :message="__('messages.noMemberAddedToProject')" />
                </td>
            </tr>
        @endforelse
    </x-table>
</div>

@endif
<script src="{{ asset('vendor/datatables/jquery.dataTables.min.js') }}"></script>
<script src="{{ asset('vendor/datatables/dataTables.bootstrap4.min.js') }}"></script>
<script>
$(document).ready(function () {
    $('#project-members-table').DataTable({});
});
</script>
