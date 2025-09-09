@extends('layouts.app')

@push('styles')
    <style>
        .avatar-group {
            display: flex;
            margin-left: -10px;
        }

        .avatar-group-item {
            margin-left: -10px;
        }

        .avatar-group-item img {
            width: 32px;
            height: 32px;
            border: 2px solid #fff;
        }
    </style>
@endpush

@section('filter-section')
    <x-filters.filter-box>
        <input type="hidden" name="activeTab" id="activeTab" value="{{ $activeTab }}">
        <!-- EMPLOYEE START -->
        <div class="select-box d-flex py-2 pr-2 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.employee')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="employee" id="employee" data-live-search="true"
                    data-size="8">
                    @if ($employees->count() > 1 || in_array('admin', user_roles()))
                        <option value="all">@lang('app.all')</option>
                    @endif
                    @foreach ($employees as $employee)
                        <x-user-option :user="$employee" />
                    @endforeach
                </select>
            </div>
        </div>

        <!-- SEARCH BY MONTH -->
        <div class="select-box d-flex py-2 px-lg-2 px-md-2 px-0 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.month')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="month" id="month" data-live-search="true"
                        data-size="8">
                    <x-forms.months :selectedMonth="$month" fieldRequired="true"/>
                </select>
            </div>
        </div>

        <!-- SEARCH BY YEAR -->
        <div class="select-box d-flex py-2 px-lg-2 px-md-2 px-0 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.year')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="year" id="year" data-live-search="true" data-size="8">
                    @for ($i = $year; $i >= $year - 4; $i--)
                        <option @if ($i == $year) selected @endif value="{{ $i }}">{{ $i }}</option>
                    @endfor
                </select>
            </div>
        </div>

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
    <div class="content-wrapper">
        <!-- Add Task Export Buttons Start -->
        <div class="d-flex my-3">
            <div id="table-actions" class="flex-grow-1 align-items-center">
                @if ($hasCreateAccess)
                <x-forms.link-primary :link="route('meetings.create').'?tab=list'" class="mr-3 openRightModal float-left" icon="plus">
                    {{ __('app.add') }} {{ __('performance::app.meeting') }}
                </x-forms.link-primary>
                @endif
            </div>

            <div class="btn-group mt-2 mt-lg-0 mt-md-0 ml-0 ml-lg-3 ml-md-3" role="group" aria-label="Basic example">
                <a href="{{ route('meetings.index') }}" class="btn btn-secondary f-14 btn-active" data-toggle="tooltip"
                    data-original-title="@lang('performance::modules.listView')"><i class="side-icon bi bi-list-ul"></i></a>

                <a href="{{ route('meetings.calendar_view') }}" class="btn btn-secondary f-14" data-toggle="tooltip"
                    data-original-title="@lang('app.menu.calendar')"><i class="side-icon bi bi-calendar"></i></a>
            </div>
        </div>

        <x-cards.data>
            <div id="list-view"></div>
        </x-cards.data>
    </div>
@endsection

@push('scripts')
    <script>
        $('#employee, #month, #year').on('change keyup', function() {
            let status = $('#activeTab').val();
            $('#reset-filters').removeClass('d-none');

            if ($('#employee').val() != "all") {
                loadData(status);
            } else if ($('#month').val() != "all") {
                loadData(status);
            } else if ($('#year').val() != "all") {
                loadData(status);
            } else {
                loadData(status);
            }
        });

        $('#search-text-field').on('keyup', function() {
            if ($('#search-text-field').val() != "") {
                $('#reset-filters').removeClass('d-none');
                let status = $('#activeTab').val();
                loadData(status);
            }
        });

        $('#reset-filters').click(function() {
            $('#filter-form')[0].reset();
            $('.filter-box #status').val('not finished');
            $('.filter-box .select-picker').selectpicker("refresh");
            $('#reset-filters').addClass('d-none');

            let status = $('#activeTab').val();
            loadData(status);
        });

        function loadData(status) {
            $.easyAjax({
                url: "{{ route('meetings.index') }}",
                type: "GET",
                data: {
                    status: status,
                    employee: $('#employee').val(),
                    month: $('#month').val(),
                    year: $('#year').val(),
                    searchText: $('#search-text-field').val()
                },
                success: function(response) {
                    if (response.status == "success") {
                        $('#activeTab').val(response.activeTab),
                        $('#list-view').html(response.html);
                    }
                }
            });
        }

        // Initial load
        let status = $('#activeTab').val();
        loadData(status);

        $('body').on('click', '.sendReminder', function() {
            let meetingId = $(this).data('meeting-id');
            var url = "{{ route('meetings.send_reminder', ':id') }}";
            url = url.replace(':id', meetingId);

            if (url) {
                $.easyAjax({
                    url: url,
                    type: "GET",
                    buttonSelector: ".sendReminder",
                    blockUI: true,
                    disableButton: true,
                    success: function(response) {
                        if (response.status == "success") {
                            $.easyUnblockUI();
                        }
                    }
                });
            }
        });

        $('body').on('click', '#pastMonthMeetings', function() {
            let status = $('#activeTab').val();
            let employee = $('#employee').val();
            let month = $('#month').val();
            let year = $('#year').val();
            let searchText = $('#search-text-field').val();
            let encodedSearchText = encodeURIComponent(searchText);

            var url = "{{ route('meetings.view_meeting_list') }}?status="+status+"&employee="+employee+"&month="+month+"&year="+year+"&searchText="+encodedSearchText;

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

    </script>
@endpush
