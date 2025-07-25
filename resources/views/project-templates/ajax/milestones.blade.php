@php
$addProjectMilestonePermission = ($project->project_admin == user()->id) ? 'all' : user()->permission('add_project_milestones');
$viewProjectMilestonePermission = ($project->project_admin == user()->id) ? 'all' : user()->permission('view_project_milestones');
$editProjectMilestonePermission = ($project->project_admin == user()->id) ? 'all' : user()->permission('edit_project_milestones');
$deleteProjectMilestonePermission = ($project->project_admin == user()->id) ? 'all' : user()->permission('delete_project_milestones');
$statuses = ['complete', 'incomplete']; // Define all your possible statuses here
@endphp

<!-- ROW START -->
<div class="row py-5">
    <div class="col-lg-12 col-md-12 mb-4 mb-xl-0 mb-lg-4">
        @if (($addProjectMilestonePermission == 'all' || $project->project_admin == user()->id))
            <x-forms.button-primary icon="plus" id="add-project-milestone" class="type-btn mb-3">
                @lang('modules.projects.createMilestone')
            </x-forms.button-primary>
        @endif

        @if ($viewProjectMilestonePermission == 'all' || $viewProjectMilestonePermission == 'added' || ($viewProjectMilestonePermission == 'owned' && $userId == $project->client_id))
            <x-cards.data :title="__('modules.projects.milestones')"
                otherClasses="border-0 p-0 d-flex justify-content-between align-items-center table-responsive-sm">
                <x-table class="border-0 pb-3 admin-dash-table table-hover">

                    <x-slot name="thead">
                        <th class="pl-20">S. No.</th>
                        <th>@lang('modules.projects.milestoneTitle')</th>
                        <th>@lang('modules.projects.milestoneCost')</th>
                        {{-- <th>@lang('modules.projects.taskCount')</th> --}}
                        <th>@lang('app.status')</th>
                        <th class="text-right pr-20">@lang('app.action')</th>
                    </x-slot>

                    @forelse($project->milestones as $key=>$item)
                        <tr id="row-{{ $item->id }}">
                            <td class="pl-20">{{ $key + 1 }}</td>
                            <td>
                                <a href="javascript:;" class="milestone-detail text-darkest-grey f-w-500"
                                    data-milestone-id="{{ $item->id }}">{{ $item->milestone_title }}</a>
                            </td>
                            <td>
                                @if (!is_null($item->currency_id))
                                    {{ currency_format($item->cost, $item->currency->id) }}
                                @else
                                    {{ currency_format($item->cost, $item->currency_id) }}
                                @endif
                            </td>
                            {{-- <td>
                                {{ $item->tasks_count }}
                            </td> --}}
                            <td>
                                <select class="form-control select-picker change-milestone-status" id="change-milestone-status" data-size="5" data-milestone-id="{{ $item->id }}">
                                    @foreach ($statuses as $status)
                                        @php
                                            $iconClass = $status == 'complete' ? 'fa fa-circle mr-1 text-dark-green' : 'fa fa-circle mr-1 text-red';
                                        @endphp
                                        <option value="{{ $status }}" data-icon="{{ $iconClass }}" @if ($item->status == $status) selected @endif>
                                            {{ trans('app.' . $status) }}
                                        </option>
                                    @endforeach
                                </select>
                            </td>

                            <td class="text-right pr-20">
                                <div class="task_view">
                                    <a href="javascript:;" data-milestone-id="{{ $item->id }}"
                                        class="taskView milestone-detail text-darkest-grey f-w-500">@lang('app.view')</a>
                                    <div class="dropdown">
                                        <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle"
                                            type="link" id="dropdownMenuLink-{{ $item->id }}" data-toggle="dropdown"
                                            aria-haspopup="true" aria-expanded="false">
                                            <i class="icon-options-vertical icons"></i>
                                        </a>
                                        <div class="dropdown-menu dropdown-menu-right"
                                            aria-labelledby="dropdownMenuLink-{{ $item->id }}" tabindex="0">

                                            @if ($editProjectMilestonePermission == 'all' || ($editProjectMilestonePermission == 'added' && (user()->id == $item->added_by || $userId == $item->added_by)))
                                                @if(is_null($project->deleted_at))
                                                    <a class="dropdown-item edit-milestone" href="javascript:;"
                                                        data-row-id="{{ $item->id }}">
                                                        <i class="fa fa-edit mr-2"></i>
                                                        @lang('app.edit')
                                                    </a>
                                                @endif
                                            @endif

                                            @if ($deleteProjectMilestonePermission == 'all' || ($deleteProjectMilestonePermission == 'added' && (user()->id == $item->added_by || $userId == $item->added_by)))
                                                <a class="dropdown-item delete-row" href="javascript:;"
                                                    data-row-id="{{ $item->id }}">
                                                    <i class="fa fa-trash mr-2"></i>
                                                    @lang('app.delete')
                                                </a>
                                            @endif

                                        </div>
                                    </div>
                                </div>

                            </td>
                        </tr>
                    @empty
                        <x-cards.no-record-found-list colspan="5"/>
                    @endforelse
                </x-table>
            </x-cards.data>
        @else
        <x-cards.no-record :message="__('messages.noRecordFound')" icon="flag" />
        @endif
    </div>

</div>
<!-- ROW END -->

<script>
    $('#add-project-milestone').click(function() {
        const url = "{{ route('project-template-milestone.create') }}" + "?id={{ $project->id }}";
        $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
        $.ajaxModal(MODAL_LG, url);

    });

    $('body').on('click', '.edit-milestone', function() {
        var id = $(this).data('row-id');

        var url = "{{ route('project-template-milestone.edit', ':id') }}";
        url = url.replace(':id', id);

        $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
        $.ajaxModal(MODAL_LG, url);

    });

    $('body').on('click', '.milestone-detail', function() {
        var id = $(this).data('milestone-id');
        var url = "{{ route('project-template-milestone.show', ':id') }}";
        url = url.replace(':id', id);
        $(MODAL_XL + ' ' + MODAL_HEADING).html('...');
        $.ajaxModal(MODAL_XL, url);
    });

    $('.delete-row').click(function() {

        var id = $(this).data('row-id');
        var url = "{{ route('project-template-milestone.destroy', ':id') }}";
        url = url.replace(':id', id);

        var token = "{{ csrf_token() }}";

        Swal.fire({
            title: "@lang('messages.sweetAlertTitle')",
            text: "@lang('messages.recoverRecord')",
            icon: 'warning',
            showCancelButton: true,
            focusConfirm: false,
            confirmButtonText: "@lang('messages.confirmDelete')",
            cancelButtonText: "@lang('app.cancel')",
            customClass: {
                confirmButton: 'btn btn-primary mr-3',
                cancelButton: 'btn btn-secondary'
            },
            showClass: {
                popup: 'swal2-noanimation',
                backdrop: 'swal2-noanimation'
            },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {
                $.easyAjax({
                    type: 'POST',
                    url: url,
                    data: {
                        '_token': token,
                        '_method': 'DELETE'
                    },
                    success: function(response) {
                        if (response.status == "success") {
                            $('#row-' + id).fadeOut();
                        }
                    }
                });
            }
        });

    });

    $(document).ready(function() {
        $('.change-milestone-status').on('change', function() {
            var milestoneId = $(this).data('milestone-id');
            var newStatus = $(this).val();
            var url = "{{ route('project-template-milestone.updateStatus', ':id') }}";
            url = url.replace(':id', milestoneId);

            var token = "{{ csrf_token() }}";

            $.easyAjax({
                type: 'POST',
                url: url,
                data: {
                    '_token': token,
                    'status': newStatus,
                    '_method': 'POST'
                },
                success: function(response) {
                    if(response.status == 'success') {
                        // Optionally, display a success message or update the UI
                        console.log('Status updated successfully');
                    }
                }
            });
        });
    });

</script>
