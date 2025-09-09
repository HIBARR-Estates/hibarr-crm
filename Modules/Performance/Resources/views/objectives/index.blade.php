@extends('layouts.app')

@push('styles')

@endpush

@section('filter-section')
    <x-filters.filter-box>
        <!-- OWNER START -->
        <div class="select-box py-2 d-flex pr-2 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('performance::app.owner')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="employee" id="employee" data-live-search="true"
                        data-size="8">
                    @if ($employees->count() > 1 || in_array('admin', user_roles()))
                        <option value="all">@lang('app.all')</option>
                    @endif
                    @foreach ($employees as $employee)
                        <x-user-option :user="$employee"/>
                    @endforeach
                </select>
            </div>
        </div>
        <!-- OWNER END -->

        <!-- DEPARTMENT START -->
        <div class="select-box d-flex py-2 px-lg-2 px-md-2 px-0 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.department')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="department" id="department">
                    <option value="all">@lang('app.all')</option>
                    @foreach ($departments as $department)
                        <option value="{{ $department->id }}">{{ $department->team_name }}</option>
                    @endforeach
                </select>
            </div>
        </div>
        <!-- DEPARTMENT END -->

        <!-- Project START -->
        <div class="select-box d-flex py-2 px-lg-2 px-md-2 px-0 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.project')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="project" id="project">
                    <option value="all">@lang('app.all')</option>
                    @foreach ($projects as $project)
                        <option value="{{ $project->id }}">{{ $project->project_name }}</option>
                    @endforeach
                </select>
            </div>
        </div>
        <!-- Project END -->

        <!-- STATUS START -->
        <div class="select-box d-flex py-2 px-lg-2 px-md-2 px-0 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.status')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="status" id="status">
                    <option value="incomplete">@lang('performance::modules.hideCompletedObjectives')</option>
                    <option value="all">@lang('app.all')</option>
                    @foreach ($statuses as $key => $status)
                        <option value="{{ $key }}">{{ $status }}</option>
                    @endforeach
                </select>
            </div>
        </div>
        <!-- STATUS END -->

        <!-- SEARCH BY TASK START -->
        <div class="task-search d-flex  py-1 px-lg-3 px-0 border-right-grey align-items-center">
            <form class="w-100 mr-1 mr-lg-0 mr-md-1 ml-md-1 ml-0 ml-lg-0">
                <div class="input-group bg-grey rounded">
                    <div class="input-group-prepend">
                        <span class="input-group-text border-0 bg-additional-grey">
                            <i class="fa fa-search f-13 text-dark-grey"></i>
                        </span>
                    </div>
                    <input type="text" class="form-control f-14 p-1 border-additional-grey" id="search-text-field"
                        placeholder="@lang('app.startTyping')">
                </div>
            </form>
        </div>
        <!-- SEARCH BY TASK END -->

        <!-- RESET START -->
        <div class="select-box d-flex py-1 px-lg-2 px-md-2 px-0">
            <x-forms.button-secondary class="btn-xs d-none" id="reset-filters" icon="times-circle">
                @lang('app.clearFilters')
            </x-forms.button-secondary>
        </div>
        <!-- RESET END -->
    </x-filters.filter-box>
@endsection

@section('content')
    <!-- CONTENT WRAPPER START -->
    <div class="content-wrapper">
        <div class="d-flex justify-content-between action-bar">
            <div id="table-actions" class="flex-grow-1 align-items-center">
                <x-forms.link-primary :link="route('objectives.create')" class="mr-3 openRightModal float-left mb-2 mb-lg-0 mb-md-0"
                    icon="plus">
                    @lang('app.add') @lang('performance::app.objective')
                </x-forms.link-primary>
            </div>
        </div>

        <div class="d-flex flex-column w-tables rounded mt-3 bg-white table-responsive" id="objecctive-table">
            @include('performance::objectives.ajax.objectives')
        </div>
    </div>
    <!-- CONTENT WRAPPER END -->
@endsection

@push('scripts')
    <script>
        function showTable() {
            let searchText = $('#search-text-field').val();
            let department = $('#department').val();
            let owner = $('#employee').val();
            let status = $('#status').val();
            let project = $('#project').val();

            $.easyAjax({
                url: "{{ route('objectives.index') }}",
                method: "GET",
                disableButton: true,
                blockUI: true,
                data: {
                    'searchText': searchText,
                    'department': department,
                    'owner': owner,
                    'status': status,
                    'project': project
                },
                success: function(response) {
                    if (response.status == "success") {
                        $('#objecctive-table').html(response.html);
                    }
                },
                error: function(xhr) {
                    console.error("An error occurred: " + xhr.status + " " + xhr.statusText);
                }
            });
        }

        $('#search-text-field').on('keyup', function() {
            if ($('#search-text-field').val() != "") {
                $('#reset-filters').removeClass('d-none');
                showTable();
            }
        });

        $('#employee, #status, #department, #project').on('change keyup', function () {
            if ($('#status').val() != "all") {
                $('#reset-filters').removeClass('d-none');
            } else if ($('#employee').val() != "all") {
                $('#reset-filters').removeClass('d-none');
            } else if ($('#department').val() != "all") {
                $('#reset-filters').removeClass('d-none');
            } else if ($('#project').val() != "all") {
                $('#reset-filters').removeClass('d-none');
            } else {
                $('#reset-filters').addClass('d-none');
            }
            showTable();
        });

        $('#reset-filters').click(function() {
            $('#filter-form')[0].reset();
            $('.filter-box .select-picker').selectpicker("refresh");
            $('#reset-filters').addClass('d-none');
            showTable();
        });

        $('.delete-objective').click(function() {
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

                    var id = $(this).data('objective-id');

                    var url = "{{ route('objectives.destroy', ':id') }}";
                    url = url.replace(':id', id);

                    var token = "{{ csrf_token() }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        blockUI: true,
                        data: {
                            '_token': token,
                            '_method': 'DELETE'
                        },
                        success: function(response) {
                            if (response.status == "success") {
                                location.reload();
                            }
                        }
                    });
                }
            });
        });

        $('.delete-key-results').click(function() {
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
                    var id = $(this).data('key-results-id');
                    var token = "{{ csrf_token() }}";

                    var url = "{{ route('key-results.destroy', ':id') }}";
                    url = url.replace(':id', id);

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        blockUI: true,
                        data: {
                            '_token': token,
                            '_method': 'DELETE'
                        },
                        success: function(response) {
                            if (response.status == "success") {
                                window.location.reload();
                            }
                        }
                    });
                }
            });
        });
    </script>
@endpush
