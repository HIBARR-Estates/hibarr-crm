@extends('layouts.public')

@push('styles')
    <link rel="stylesheet" href="{{ asset('vendor/frappe/frappe-gantt.css') }}">
    <script src="https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.js"></script>
    <link href="https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.css" rel="stylesheet">

    <link rel="stylesheet" href="https://worksuite-test.test/vendor/css/daterangepicker.css">
        <style>
            .gantt_grid_scale .gantt_grid_head_cell,
            .gantt_task .gantt_task_scale .gantt_scale_cell {
                font-weight: 500;
                font-size: 13px;
            }

            .gantt_row_project {
                font-weight: bold;
            }

            .resource_marker {
                text-align: center;
            }

            .resource_marker div {
                width: 28px;
                height: 28px;
                line-height: 29px;
                display: inline-block;
                border-radius: 15px;
                color: #FFF;
                margin: 3px;
            }

            .resource_marker.workday_ok div {
                background: #51c185;
            }

            .resource_marker.workday_over div {
                background: #ff8686;
            }



            .owner-label {
                width: 20px;
                height: 20px;
                line-height: 20px;
                font-size: 12px;
                display: inline-block;
                border: 1px solid #cccccc;
                border-radius: 25px;
                background: #e6e6e6;
                color: #6f6f6f;
                margin: 0 3px;
                font-weight: bold;
            }

            .gantt_tooltip {
                font-size: 13px;
                line-height: 16px;
            }

            .gantt_tree_content {
                overflow:hidden;
                text-overflow: ellipsis;
            }

            div#gantt_here {
                margin-bottom: 100px;
            }

            .gantt_task_link .gantt_line_wrapper div{
                background-color: var(--header_color) !important;
            }

            .gantt_link_arrow_right {
                border-left-color:  var(--header_color);
            }

            .gantt_link_arrow_left {
                border-right-color:  var(--header_color);
            }

            .gantt_project .gantt_link_control, .gantt_milestone .gantt_link_control {
                display: none;
            }

            .gantt_right.gantt_side_content {
                top: 0 !important;
            }

        </style>
    @endpush


@section('content')
<!-- ROW START -->
<div class="row py-3">
    <div class="col-lg-12 col-md-12 mb-4 mb-xl-0 mb-lg-4">
        <!-- Add Task Export Buttons Start -->
        <div class="d-flex align-items-center" id="table-actions">

            {{-- <div>
                <x-forms.checkbox :checked="($hideCompleted == 1)"
                    :fieldLabel="__('modules.tasks.hideCompletedTask')"
                    fieldName="hide_completed"
                    fieldId="hide_completed_tasks"/>
            </div> --}}


        </div>
        <!-- Add Task Export Buttons End -->

    </div>

</div>
<!-- ROW END -->


<!-- ROW START -->
<div class="row ">
    <div class="col-lg-12 col-md-12 mb-4 mb-xl-0 mb-lg-4">
        <!-- Add Task Export Buttons Start -->
        <div class="d-lg-flex d-md-flex d-block flex-wrap client-list-filter">
            <div class="select-box d-flex pr-2">
                <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.duration')</p>
                <div class="select-status d-flex">
                    <input type="text" class="position-relative text-dark form-control border-0 p-2 text-left f-14 f-w-500 border-additional-grey"
                        id="datatableRange2" placeholder="@lang('placeholders.dateRange')">
                </div>
            </div>

            <div class="select-box d-flex pr-2">
                <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.milestone') @lang('app.status')</p>
                <div class="select-status">
                    <select class="form-control select-picker" name="milestone_status" id="milestone_status" data-live-search="true" data-size="8">
                        <option selected value="all">@lang('app.all')</option>
                        <option value="complete">@lang('app.complete')</option>
                        <option value="incomplete">@lang('app.incomplete')</option>
                    </select>
                </div>
            </div>

            <div class="select-box d-flex pr-2">
                <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.task') @lang('app.status')</p>
                <div class="select-status">
                    <select class="form-control select-picker" name="task_status" id="task_status" data-live-search="true" data-size="8">
                        <option value="not finished">@lang('modules.tasks.hideCompletedTask')</option>
                        <option selected value="all">@lang('app.all')</option>
                        @foreach ($taskBoardStatus as $status)
                            <option value="{{ $status->id }}">{{ $status->slug == 'completed' || $status->slug == 'incomplete' ? __('app.' . $status->slug) : $status->column_name }}</option>
                        @endforeach
                    </select>
                </div>
            </div>

            <div class="select-box d-flex py-1 px-lg-2 px-md-2 px-0">
                <x-forms.button-secondary class="btn-xs d-none" id="reset-filters" icon="times-circle">
                    @lang('app.clearFilters')
                </x-forms.button-secondary>
            </div>
        </div>

        <div id="gantt_here" class="mt-4" style='width:100%; height:700px;'></div>
    </div>
</div>
<!-- ROW END -->

@php
    // might be null if the slug doesn't exist
    $completedId = optional($taskBoardStatus->firstWhere('slug', 'completed'))->id;
@endphp
@push('scripts')
    @include('sections.daterange_js')
<script>
    $(function() {

        var start = moment().clone().startOf('isoWeek');
        var end = moment().clone().endOf('isoWeek');
        var dateFormat = '{{ $dateformat }}';

        $('#datatableRange2').daterangepicker({
            locale: {
                format: dateFormat,
                separator: ' To ',
            },
            linkedCalendars: false,
            autoUpdateInput: false,
            ranges: {
                'This Week' : [moment().startOf('isoWeek'), moment().endOf('isoWeek')],
                'Last Week' : [moment().subtract(1,'week').startOf('isoWeek'),
                            moment().subtract(1,'week').endOf('isoWeek')]
            },
            showDropdowns: true,
        }, function(start, end, label) {
                if (label === 'This Week' || label === 'Last Week') {
                    this.setStartDate(start.clone().startOf('isoWeek'));
                    this.setEndDate(  end.clone().endOf('isoWeek'));
                }
        });

        function renderGantt() {

            const milestoneStatusId  = $('#milestone_status').val();
            const taskStatusId  = $('#task_status').val();
            const completedId = @json($completedId);

            const drp       = $('#datatableRange2').data('daterangepicker');
            const hasRange  = $('#datatableRange2').val() !== '';
            const rs = drp.startDate.clone().startOf('day');
            const re = drp.endDate.clone().endOf('day');

            let tasks = [...ganttData.data];

            if (hasRange) {

                const inRange = s => moment(s, dateFormat, true).isBetween(rs, re, null, '[]');

                const tasksInRange = ganttData.data.filter(row =>
                    row.type === 'task' && inRange(row.start_date)
                );

                const projectIdsFromTasks = new Set(tasksInRange.map(t => t.parent));

                const projectsKept = ganttData.data.filter(row =>
                    row.type === 'project' &&
                    ( inRange(row.start_date) || projectIdsFromTasks.has(row.id) )
                );

                const hasTask = Object.fromEntries(
                    Array.from(projectIdsFromTasks).map(id => [id, true])
                );

                const milestonesKept = ganttData.data.filter(row =>
                    row.type === 'milestone' &&
                    ( inRange(row.start_date) || hasTask[row.parent] )
                );

                /* 6️⃣  final list (dedup with Map to honour original order) */
                const uniq = new Map();
                [...projectsKept, ...tasksInRange, ...milestonesKept].forEach(r => uniq.set(r.id, r));
                tasks = Array.from(uniq.values());
            }

            if (milestoneStatusId) {
                if(milestoneStatusId != 'all'){
                    tasks = tasks.filter(t => {
                        const milestoneStatus = t.milestone_status;
                        return !t.milestone_status || milestoneStatus == milestoneStatusId
                    });
                } else {
                    tasks = tasks.filter(t => { return t });
                }
            }

            if (taskStatusId !== 'all') {
                if(taskStatusId == 'not finished') {
                    tasks = tasks.filter(t => {
                        const taskStatus = t.task_status;
                        return !t.task_status || taskStatus !== completedId
                    });
                } else {
                    tasks = tasks.filter(t => {
                        const taskStatus = t.task_status;
                        return !t.task_status || taskStatus == taskStatusId
                    });
                }
            }

            const links = ganttData.links.filter(l => {
                return tasks.find(t => t.id == l.source) &&
                    tasks.find(t => t.id == l.target);
            });
            const tasksAreEmpty = tasks.length === 0;

            if (hasRange && tasksAreEmpty) {
                gantt.config.start_date = rs.toDate();
                gantt.config.end_date   = re.toDate();
                gantt.render();
                gantt.showDate(rs.toDate());
            }else {
                gantt.config.start_date = null;
                gantt.config.end_date = null;
            }

            gantt.clearAll();
            gantt.parse({ data: tasks, links: links });

            if (hasRange || milestoneStatusId !== 'all' || taskStatusId !== 'all') {
                $('#reset-filters').removeClass('d-none');
            } else {
                $('#reset-filters').addClass('d-none');
            }
        }

        $('#datatableRange2').on('apply.daterangepicker', function (ev, picker) {
            $(this).val(
                picker.startDate.format(dateFormat) +
                ' To ' +
                picker.endDate.format(dateFormat)
            );

            renderGantt();
        });

        $('#milestone_status, #task_status').on('change', function() {
            if ($('#milestone_status').val()) {
                $('#reset-filters').removeClass('d-none');
                renderGantt();
            } else if ($('#task_status').val() != "all") {
                $('#reset-filters').removeClass('d-none');
                renderGantt();
            }
        });

        $('#reset-filters').click(function() {
            // $('#datatableRange2').val('');
            const picker = $('#datatableRange2').data('daterangepicker');

            $('#datatableRange2').val('');
            $('#milestone_status').val('all').selectpicker('refresh');
            $('#task_status').val('all').selectpicker('refresh');
            $('#reset-filters').addClass('d-none');
            renderGantt();
        });
    });
</script>
@endpush
<script>
var ganttData = @json($ganttData);


    function linkTypeToString(linkType) {
        switch (linkType) {
            case gantt.config.links.start_to_start:
                return "Start to start";
            case gantt.config.links.start_to_finish:
                return "Start to finish";
            case gantt.config.links.finish_to_start:
                return "Finish to start";
            case gantt.config.links.finish_to_finish:
                return "Finish to finish";
            default:
                return ""
        }
    }


    var daysStyle = function(date){

        var dateToStr = gantt.date.date_to_str("%D");

        if (dateToStr(date) == "Sun"||dateToStr(date) == "Sat")  return "weekend";

        return "";
    };

    var weekScaleTemplate = function (date) {
		var dateToStr = gantt.date.date_to_str("%d %M, %y");
		var endDate = gantt.date.add(gantt.date.add(date, 1, "week"), -1, "day");
		return dateToStr(date) + " - " + dateToStr(endDate);
	};

    gantt.config.scales = [
		// {unit: "month", format: "%F, %Y"},
        {unit: "week", step: 1, format: weekScaleTemplate},
		{unit: "day", step: 1, format: "%j, %D", css:daysStyle},
	];

    gantt.config.scale_height = 54;


    gantt.plugins({
        tooltip: true,
        marker: true,
        keyboard_navigation: true,
    });
    gantt.templates.tooltip_date_format = gantt.date.date_to_str("%F %j, %Y");


    gantt.config.columns = [
        { name: "text",  align: "left", tree: true, width: 200, resize: true,  },
        { name: "start_date", align: "center", width: 80, resize: true },
        { name: "duration", width: 60, align: "center" }
    ];


    gantt.config.order_branch = false;
    gantt.config.open_tree_initially = false;
    gantt.config.layout = {
        css: "gantt_container",
        rows: [
            {
                cols: [
                    { view: "grid", group: "grids", scrollY: "scrollVer" },
                    { resizer: true, width: 1 },
                    { view: "timeline", scrollX: "scrollHor", scrollY: "scrollVer" },
                    { view: "scrollbar", id: "scrollVer", group: "vertical" }
                ],
                gravity: 2
            },
            { resizer: true, width: 1 },

            { view: "scrollbar", id: "scrollHor" }
        ]
    };

    var resourcesStore = gantt.createDatastore({
		name: gantt.config.resource_store,
		type: "treeDatastore",
		initItem: function (item) {
			item.parent = item.parent || gantt.config.root_id;
			item[gantt.config.resource_property] = item.parent;
			item.open = true;
			return item;
		}
	});

    gantt.attachEvent("onTaskCreated", function(task){
        task[gantt.config.resource_property] = [];
        return true;
    });

    gantt.init("gantt_here");

    resourcesStore.attachEvent("onParse", function(){
		var people = [];
		resourcesStore.eachItem(function(res){
			if(!resourcesStore.hasChild(res.id)){
				var copy = gantt.copy(res);
				copy.key = res.id;
				copy.label = res.text;
				people.push(copy);
			}
		});
		gantt.updateCollection("people", people);
	});

    gantt.templates.grid_folder = function(item) {
        return `<div
        class='gantt_tree_icon mr-1 ${(item.$open ? "fas fa-chevron-down" : "fas fa-chevron-right")}'>
        </div>`;
    };

    gantt.templates.grid_file = function(item) {
        return "";
    };

    gantt.templates.tooltip_text = function(start,end,task){
        return task.view;
    };

    gantt.templates.scale_cell_class = function(date){
        if(date.getDay()==0||date.getDay()==6) {
            return "weekend";
        }
    };
    gantt.templates.timeline_cell_class = function(task,date){
        if (date.getDay()==0||date.getDay()==6) {
            return "weekend" ;
        }
    };

    var dateToStr = gantt.date.date_to_str(gantt.config.task_date);
    var markerId = gantt.addMarker({
        start_date: new Date(), //a Date object that sets the marker's date
        css: "today", //a CSS class applied to the marker
        text: "@lang('app.today')", //the marker title
        title: dateToStr( new Date()) // the marker's tooltip
    });

    gantt.templates.task_text = function(start, end, task){
        return task.text;
    };

    gantt.templates.rightside_text = function(start, end, task){
        if (task.type == "milestone" || task.type == "project") {
            return false;
        }

        return task.text_user;
    };

    gantt.config.readonly = true;

    gantt.config.drag_progress = false;
    gantt.config.details_on_dblclick = false;

    // gantt.config.links.finish_to_start = false;
    // gantt.config.links.start_to_start = false;
    // gantt.config.links.finish_to_finish = false;
    // gantt.config.links.start_to_finish = false;

    gantt.parse(ganttData);
    gantt.showDate(new Date());

</script>

<script>

    gantt.attachEvent("onBeforeLinkAdd", function(id,link){
        var target_task = gantt.getTask(link.target);
        if (target_task.linkable == false) {
            gantt.message({type:"warning", text:"Milestone cannot be linked"});
            return false;
        }
        return true;
    });

    gantt.attachEvent("onLinkCreated", function(link){
        var target_task = gantt.getTask(link.target);

        if (target_task.type == 'project') {
            return false;
        }

        var url = "{{ route('gantt_link.store') }}";
        var token = "{{ csrf_token() }}";

        $.easyAjax({
            url: url,
            type: "POST",
            blockUI: true,
            container: '#gantt_here',
            data: { source: link.source, target: link.target, type: link.type, project: '{{ $project->id }}', '_token': token},
            success: function (response) {

            }
        });
        // your code here
        return true;
    });

    gantt.attachEvent("onAfterLinkDelete", function(id,link){
        var url = "{{ route('gantt_link.destroy', ':id') }}";
        url = url.replace(':id', id);
        var token = "{{ csrf_token() }}";

        $.easyAjax({
            url: url,
            type: "POST",
            blockUI: true,
            container: '#gantt_here',
            data: { id: id, '_token': token, '_method': 'DELETE'},
            success: function (response) {

            }
        });
        // your code here
        return true;
        //any custom logic here
    });

    gantt.attachEvent("onAfterTaskDrag", function(id, mode, e){
        var task = gantt.getTask(id);

        var url = "{{ route('gantt_link.task_update') }}";
        var token = "{{ csrf_token() }}";
        var start_date = new Date(task.start_date);
        var end_date = new Date(task.end_date);

        const syear = start_date.getFullYear();
        const smonth = String(start_date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const sday = String(start_date.getDate()).padStart(2, '0');
        const sformattedDate = `${syear}-${smonth}-${sday}`;

        const eyear = end_date.getFullYear();
        const emonth = String(end_date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const eday = String(end_date.getDate()).padStart(2, '0');
        const eformattedDate = `${eyear}-${emonth}-${eday}`;

        $.easyAjax({
            url: url,
            type: "POST",
            blockUI: true,
            container: '#gantt_here',
            data: { id: id, start_date: sformattedDate, end_date: eformattedDate,'_token': token},
            success: function (response) {

            }
        });

        //any custom logic here
    });

    gantt.attachEvent("onBeforeTaskDrag", function(id, mode, e){
        var task = gantt.getTask(id);

        if (task.type == "milestone" || allowDrag == 'false') {
            return false;
        }

        return true;
        //any custom logic here
    });

    gantt.attachEvent("onTaskDblClick", function(id, e){
        var task = gantt.getTask(id);

        if (task.type == "milestone" || task.type == "project") {
            return false;
        }

        openTaskDetail();
        var url = "{{ route('front.task_detail', ':id') }}";
        url = url.replace(':id', task.hash);

        $.easyAjax({
            url: url,
            blockUI: true,
            container: RIGHT_MODAL,
            historyPush: true,
            success: function (response) {
                if (response.status == "success") {
                    $(RIGHT_MODAL_CONTENT).html(response.html);
                    $(RIGHT_MODAL_TITLE).html(response.title);
                }
            }
        });
        //any custom logic here
        return true;
    });

    {{-- $('#hide_completed_tasks').change(function () {
        if($(this).is(':checked')){
            window.location.href = "{{ url()->temporarySignedRoute('front.gantt', now()->addDays(\App\Models\GlobalSetting::SIGNED_ROUTE_EXPIRY), $project->hash) }}" + '&hide_completed=1';
        } else {
            window.location.href = "{{ url()->temporarySignedRoute('front.gantt', now()->addDays(\App\Models\GlobalSetting::SIGNED_ROUTE_EXPIRY), $project->hash) }}";
        }
    }); --}}
</script>
@endsection