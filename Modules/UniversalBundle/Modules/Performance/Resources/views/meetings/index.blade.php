@extends('layouts.app')

@push('styles')
    <link rel="stylesheet" href="{{ asset('vendor/full-calendar/main.min.css') }}">
    <link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-colorpicker.css') }}" />
@endpush

@section('filter-section')
    <x-filters.filter-box>
        <!-- EMPLOYEE START -->
        <div class="select-box d-flex py-2 pr-2 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.employee')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="employee" id="employee" data-live-search="true"
                    data-size="8">
                    <option value="all">@lang('app.all')</option>
                    @foreach ($employees as $employee)
                        <x-user-option :user="$employee" />
                    @endforeach
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
                    <x-forms.link-primary :link="route('meetings.create').'?tab=calendar'" class="mr-3 openRightModal float-left" icon="plus">
                        {{ __('app.add') }} {{ __('performance::app.meeting') }}
                    </x-forms.link-primary>
                @endif
            </div>

            <div class="btn-group mt-2 mt-lg-0 mt-md-0 ml-0 ml-lg-3 ml-md-3" role="group" aria-label="Basic example">
                <a href="{{ route('meetings.index') }}" class="btn btn-secondary f-14" data-toggle="tooltip"
                    data-original-title="@lang('performance::modules.listView')"><i class="side-icon bi bi-list-ul"></i></a>

                <a href="{{ route('meetings.calendar_view') }}" class="btn btn-secondary f-14 btn-active" data-toggle="tooltip"
                    data-original-title="@lang('app.menu.calendar')"><i class="side-icon bi bi-calendar"></i></a>
            </div>
        </div>

        <x-cards.data>
            <div id="calendar"></div>
        </x-cards.data>
    </div>
@endsection

@push('scripts')
    <script src="{{ asset('vendor/full-calendar/main.min.js') }}"></script>
    <script src="{{ asset('vendor/full-calendar/locales-all.min.js') }}"></script>

    <script>
        $('#employee').on('change keyup', function() {
            if ($('#employee').val() != "all") {
                $('#reset-filters').removeClass('d-none');
                loadData();
            } else {
                $('#reset-filters').addClass('d-none');
                loadData();
            }
        });

        $('#search-text-field').on('keyup', function() {
            if ($('#search-text-field').val() != "") {
                $('#reset-filters').removeClass('d-none');
                loadData();
            }
        });

        $('#reset-filters').click(function() {
            $('#filter-form')[0].reset();
            $('.filter-box #status').val('not finished');
            $('.filter-box .select-picker').selectpicker("refresh");
            $('#reset-filters').addClass('d-none');
            loadData();
        });

        var initialLocaleCode = '{{ user()->locale }}';
        var calendarEl = document.getElementById('calendar');

        var calendar = new FullCalendar.Calendar(calendarEl, {
            locale: initialLocaleCode,
            timeZone: '{{ company()->timezone }}',
            firstDay: parseInt("{{ attendance_setting()?->week_start_from }}"),
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            },
            navLinks: true, // can click day/week names to navigate views
            selectable: false,
            selectMirror: true,
            select: function(arg) {
                addEventModal(arg.start, arg.end, arg.allDay);
                calendar.unselect()
            },
            eventClick: function(arg) {
                getEventDetail(arg.event.id);
            },
            editable: false,
            dayMaxEvents: true, // allow "more" link when too many events
            events: {
                url: "{{ route('meetings.calendar_view') }}",
                extraParams: function() {
                    var searchText = $('#search-text-field').val();
                    var employeeId = $('#employee').val();

                    return {
                        searchText: searchText,
                        employeeId: employeeId
                    };
                }
            },
            eventDidMount: function(info) {
                var eventStatus = info.event.extendedProps.status;
                if (eventStatus) {
                    if (eventStatus == 'pending') {
                        $(info.el).css('background-color', '#FFA726');
                        $(info.el).css('color', '#000000'); // Black text for contrast
                    } else if (eventStatus == 'completed') {
                        $(info.el).css('background-color', '#008000');
                        $(info.el).css('color', '#FFFFFF'); // White text for contrast
                    } else if (eventStatus == 'cancelled') {
                        $(info.el).css('background-color', '#ff0000');
                        $(info.el).css('color', '#FFFFFF'); // White text for contrast
                    } else if (eventStatus == '') {
                        $(info.el).css('background-color', '#0000ff');
                        $(info.el).css('color', '#000000'); // Black text for contrast
                    }
                }
            },
            eventTimeFormat: {
                hour: company.time_format == 'H:i' ? '2-digit' : 'numeric',
                minute: '2-digit',
                hour12: company.time_format == 'H:i' ? false : true,
                meridiem: company.time_format == 'H:i' ? false : true
            }
        });

        calendar.render();

        function loadData() {
            calendar.refetchEvents();
            $('#calendar').append('<div class="loading-indicator">Loading...</div>');
            calendar.destroy();
            calendar.render();
            $('#calendar .loading-indicator').remove();
        }

        // show event detail in sidebar
        var getEventDetail = function(id) {
            openTaskDetail();
            var url = "{{ route('meetings.show', ':id') }}";
            url = url.replace(':id', id);

            $.easyAjax({
                url: url,
                blockUI: true,
                container: RIGHT_MODAL,
                historyPush: true,
                success: function(response) {
                    if (response.status == "success") {
                        $(RIGHT_MODAL_CONTENT).html(response.html);
                        $(RIGHT_MODAL_TITLE).html(response.title);
                    }
                },
                error: function(request, status, error) {
                    if (request.status == 403) {
                        $(RIGHT_MODAL_CONTENT).html(
                            '<div class="align-content-between d-flex justify-content-center mt-105 f-21">403 | Permission Denied</div>'
                        );
                    } else if (request.status == 404) {
                        $(RIGHT_MODAL_CONTENT).html(
                            '<div class="align-content-between d-flex justify-content-center mt-105 f-21">404 | Not Found</div>'
                        );
                    } else if (request.status == 500) {
                        $(RIGHT_MODAL_CONTENT).html(
                            '<div class="align-content-between d-flex justify-content-center mt-105 f-21">500 | Something Went Wrong</div>'
                        );
                    }
                }
            });
        }
    </script>
@endpush
