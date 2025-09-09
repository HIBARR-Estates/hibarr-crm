@extends('layouts.app')

@push('datatable-styles')
    @include('sections.datatable_css')
@endpush

@section('filter-section')

    <x-filters.filter-box>
        <!-- DATE START -->
        <div class="select-box d-flex py-2 pr-2 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.duration')</p>
            <div class="select-status">
                <input type="text" class="position-relative text-dark form-control border-0 p-2 text-left f-14 f-w-500 border-additional-grey"
                       id="datatableRange" placeholder="@lang('placeholders.dateRange')">
            </div>
        </div>
        <!-- DATE END -->

        <!-- STATUS START -->
        <div
            class="select-box d-flex py-2 px-lg-3 px-md-3 px-0 border-right-grey align-items-center border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.status')</p>
            <div class="select-status d-flex">
                <select class="form-control select-picker" name="status" id="status">
                    <option  value="all">@lang('app.all')</option>
                    <option value="not finished">@lang('zoom::modules.zoommeeting.hideFinishedMeetings')
                    </option>
                    <option value="waiting">@lang('zoom::modules.zoommeeting.waiting')</option>
                    <option value="live">@lang('zoom::modules.zoommeeting.live')</option>
                    <option value="canceled">@lang('app.canceled')</option>
                    <option value="finished">@lang('app.finished')</option>
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
        <div class="select-box d-flex py-2 px-lg-3 px-md-3 px-0">
            <x-forms.button-secondary class="btn-xs d-none" id="reset-filters" icon="times-circle">
                @lang('app.clearFilters')
            </x-forms.button-secondary>
        </div>
        <!-- RESET END -->

        <!-- MORE FILTERS START -->
        <x-filters.more-filter-box>
            <div class="more-filter-items">
                <label class="f-14 text-dark-grey mb-12 " for="usr">@lang('app.project')</label>
                <div class="select-filter mb-4">
                    <div class="select-others">
                        <select class="form-control select-picker" name="project_id" id="project_id"
                                data-live-search="true" data-container="body"
                                data-size="8">
                            <option value="all">@lang('app.all')</option>
                            @foreach ($projects as $project)
                                <option value="{{ $project->id }}">{{ $project->project_name }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
            </div>
            <div class="more-filter-items">
                <label class="f-14 text-dark-grey mb-12 " for="usr">@lang('app.client')</label>
                <div class="select-filter mb-4">
                    <div class="select-others">
                        <select class="form-control select-picker" id="clientID" data-container="body"
                                data-live-search="true" data-size="8">
                            <option value="all">@lang('app.all')</option>
                            @foreach ($clients as $client)
                                <x-user-option :user="$client" />
                            @endforeach
                        </select>
                    </div>
                </div>
            </div>
            <div class="more-filter-items">
                <label class="f-14 text-dark-grey mb-12 " for="usr">@lang('app.employee')</label>
                <div class="select-filter mb-4">
                    <div class="select-others">
                        <select class="form-control select-picker" id="employee" data-container="body"
                                data-live-search="true" data-size="8">
                            <option value="all">@lang('app.all')</option>
                            @foreach ($employees as $employee)
                                <x-user-option :user="$employee" />
                            @endforeach
                        </select>
                    </div>
                </div>
            </div>

            <div class="more-filter-items">
                <label class="f-14 text-dark-grey mb-12 "
                       for="usr">@lang('modules.tasks.category')</label>
                <div class="select-filter mb-4">
                    <div class="select-others">
                        <select class="form-control select-picker" id="category" data-live-search="true" data-size="8">
                            <option value="all">@lang('app.all')</option>
                            @foreach ($categories as $category)
                                <option value="{{ $category->id }}">{{ $category->category_name }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
            </div>

        </x-filters.more-filter-box>
        <!-- MORE FILTERS END -->
    </x-filters.filter-box>

@endsection

@php
    $addMeetingPermission = user()->permission('add_zoom_meetings');
@endphp

@section('content')
    <!-- CONTENT WRAPPER START -->
    <div class="content-wrapper">
        <!-- Add Task Export Buttons Start -->
        <div class="d-flex">
            <div id="table-actions" class="flex-grow-1 align-items-center">
                @if ($addMeetingPermission == 'all' || $addMeetingPermission == 'added')
                    <x-forms.link-primary :link="route('zoom-meetings.create')" class="mr-3 openRightModal float-left"
                                          icon="plus">
                        @lang('zoom::modules.zoommeeting.addMeeting')
                    </x-forms.link-primary>
                @endif
            </div>

            <x-datatable.actions>
                <div class="select-status mr-3 pl-3">
                    <select name="action_type" class="form-control select-picker" id="quick-action-type" disabled>
                        <option value="">@lang('app.selectAction')</option>
                        <option value="change-status">@lang('modules.tasks.changeStatus')</option>
                        <option value="delete">@lang('app.delete')</option>

                    </select>
                </div>
                <div class="select-status mr-3 d-none quick-action-field" id="change-status-action">
                    <select name="status" class="form-control select-picker">
                        <option value="canceled">@lang('app.canceled')</option>
                    </select>
                </div>
            </x-datatable.actions>

            <div class="btn-group" role="group">
                <a href="{{ route('zoom-meetings.index') }}" class="btn btn-secondary f-15 btn-active ml-3"
                   data-toggle="tooltip" data-original-title="@lang('modules.leaves.tableView')"><i
                        class="side-icon bi bi-list-ul"></i></a>

                <a href="{{ route('zoom-meetings.calendar') }}" class="btn btn-secondary f-15" data-toggle="tooltip"
                   data-original-title="@lang('app.menu.calendar')"><i class="side-icon bi bi-calendar"></i></a>
            </div>
        </div>

        <!-- Add Task Export Buttons End -->
        <!-- Task Box Start -->
        <div class="d-flex flex-column w-tables rounded mt-3 bg-white">

            {!! $dataTable->table(['class' => 'table table-hover border-0 w-100']) !!}

        </div>
        <!-- Task Box End -->
    </div>
    <!-- CONTENT WRAPPER END -->

@endsection

@push('scripts')
    @include('sections.datatable_js')
    <script src="{{ asset('vendor/jquery/clipboard.min.js') }}"></script>

    <script>
        var clipboard = new ClipboardJS('.btn-copy');

        clipboard.on('success', function(e) {
            Swal.fire({
                icon: 'success',
                text: '@lang("app.copied")',
                toast: true,
                position: 'top-end',
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false,
                customClass: {
                    confirmButton: 'btn btn-primary',
                },
                showClass: {
                    popup: 'swal2-noanimation',
                    backdrop: 'swal2-noanimation'
                },
            })
        });
        $('#meeting-table').on('preXhr.dt', function (e, settings, data) {

            var dateRangePicker = $('#datatableRange').data('daterangepicker');
            var startDate = $('#datatableRange').val();

            if (startDate == '') {
                startDate = null;
                endDate = null;
            } else {
                startDate = dateRangePicker.startDate.format('{{ $global->moment_format }}');
                endDate = dateRangePicker.endDate.format('{{ $global->moment_format }}');
            }

            var projectID = $('#project_id').val();
            if (!projectID) {
                projectID = 0;
            }

            var status = $('#status').val();
            var employee = $('#employee').val();
            var client = $('#clientID').val();
            var category = $('#category').val();
            var project = $('#project').val();
            var searchText = $('#search-text-field').val();

            data['employee'] = employee;
            data['client'] = client;
            data['startDate'] = startDate;
            data['endDate'] = endDate;
            data['status'] = status;
            data['category'] = category;
            data['project'] = project;
            data['searchText'] = searchText;
        });
        const showTable = () => {
            window.LaravelDataTables["meeting-table"].draw(true);
        }

        $('#status, #search-text-field, #clientID, #category_id, #employee, #project_id')
            .on('change keyup',
                function () {
                    if ($('#status').val() != "not finished") {
                        $('#reset-filters').removeClass('d-none');
                        showTable();
                    } else if ($('#project_id').val() != "all") {
                        $('#reset-filters').removeClass('d-none');
                        showTable();
                    } else if ($('#clientID').val() != "all") {
                        $('#reset-filters').removeClass('d-none');
                        showTable();
                    } else if ($('#category_id').val() != "all") {
                        $('#reset-filters').removeClass('d-none');
                        showTable();
                    } else if ($('#employee').val() != "all") {
                        $('#reset-filters').removeClass('d-none');
                        showTable();
                    } else if ($('#search-text-field').val() != "") {
                        $('#reset-filters').removeClass('d-none');
                        showTable();
                    } else {
                        $('#reset-filters').addClass('d-none');
                        showTable();
                    }
                });

        $('#reset-filters').click(function () {
            $('#filter-form')[0].reset();
            $('.filter-box #status').val('not finished');
            $('.filter-box .select-picker').selectpicker("refresh");
            $('#reset-filters').addClass('d-none');
            showTable();
        });

        $('#reset-filters-2').click(function () {
            $('#filter-form')[0].reset();
            $('.filter-box #status').val('not finished');
            $('.filter-box .select-picker').selectpicker("refresh");
            $('#reset-filters').addClass('d-none');
            showTable();
        });

        $('#quick-action-type').change(function () {
            const actionValue = $(this).val();
            if (actionValue != '') {
                $('#quick-action-apply').removeAttr('disabled');

                if (actionValue == 'change-status') {
                    $('.quick-action-field').addClass('d-none');
                    $('#change-status-action').removeClass('d-none');
                } else {
                    $('.quick-action-field').addClass('d-none');
                }
            } else {
                $('#quick-action-apply').attr('disabled', true);
                $('.quick-action-field').addClass('d-none');
            }
        });

        $('#quick-action-apply').click(function () {
            const actionValue = $('#quick-action-type').val();
            if (actionValue == 'delete') {
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
                        applyQuickAction();
                    }
                });

            } else {
                applyQuickAction();
            }
        });

        $('body').on('click', '.delete-table-row', function () {
            var id = $(this).data('meeting-id');
            var occurrence = $(this).data('occurrence');

            var token = "{{ csrf_token() }}";
            var dataObject = {
                '_token': token,
                '_method': 'DELETE'
            };

            if (occurrence == '1') {
                buttonText = "{{ trans('zoom::modules.zoommeeting.deleteAllOccurrences') }}";
                dataObject.recurring = 'yes';
            } else {
                buttonText = "@lang('app.yes')";
            }

            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('messages.recoverRecord')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: buttonText,
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
                    var url = "{{ route('zoom-meetings.destroy', ':id') }}";
                    url = url.replace(':id', id);

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        blockUI: true,
                        data: dataObject,
                        success: function (response) {
                            if (response.status == "success") {
                                window.LaravelDataTables["meeting-table"].draw(true);
                            }
                        }
                    });
                }
            });
        });

        const applyQuickAction = () => {
            var rowdIds = $("#meeting-table input:checkbox:checked").map(function () {
                return $(this).val();
            }).get();

            var url = "{{ route('zoom-meetings.apply_quick_action') }}?row_ids=" + rowdIds;

            $.easyAjax({
                url: url,
                container: '#quick-action-form',
                type: "POST",
                disableButton: true,
                buttonSelector: "#quick-action-apply",
                data: $('#quick-action-form').serialize(),
                success: function (response) {
                    if (response.status == 'success') {
                        showTable();
                        resetActionButtons();
                    }
                }
            })
        };

        $('body').on('click', '.cancel-meeting', function () {
            var id = $(this).data('meeting-id');

            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: "@lang('app.yes')",
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
                    var url = "{{ route('zoom-meetings.cancel_meeting', ':id') }}";
                    url = url.replace(':id', id);

                    var token = "{{ csrf_token() }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        data: {
                            '_token': token,
                            'id': id
                        },
                        success: function (response) {
                            if (response.status == "success") {
                                window.LaravelDataTables["meeting-table"].draw(true);
                            }
                        }
                    });
                }
            });
        });

        $('body').on('click', '.end-meeting', function () {
            var id = $(this).data('meeting-id');

            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: "@lang('app.yes')",
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
                    var url = "{{ route('zoom-meetings.end_meeting') }}";

                    var dataObject = {
                        '_token': token,
                        'id': id
                    };

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        data: {
                            '_token': token,
                            'id': id
                        },
                        success: function (response) {
                            if (response.status == "success") {
                                window.LaravelDataTables["meeting-table"].draw(true);
                            }
                        }
                    });
                }
            });
        });

    </script>
@endpush
