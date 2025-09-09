@php
    $manageZoomCategoryPermission = user()->permission('manage_zoom_category');
@endphp

<link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-colorpicker.css') }}"/>

<div class="row">
    <div class="col-sm-12">
        <x-form id="save-event-data-form" method="PUT">
            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                    @lang('zoom::modules.zoommeeting.meetingDetails')</h4>
                <div class="row p-20">

                    <div class="col-md-6">
                        <x-forms.text :fieldLabel="__('zoom::modules.zoommeeting.meetingName')"
                                      fieldName="meeting_title" fieldRequired="true" fieldId="meeting_title"
                                      fieldPlaceholder=""
                                      :fieldValue="$event->meeting_name"/>
                    </div>

                    <div class="col-md-6 col-lg-3">
                        <x-forms.label class="mt-3" fieldId="category_id" :fieldLabel="__('app.category')">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="category_id" id="category_id"
                                    data-live-search="true" data-size="8">
                                <option value="">--</option>
                                @foreach ($categories as $category)
                                    <option @if ($category->id == $event->category_id) selected
                                            @endif value="{{ $category->id }}">
                                        {{ $category->category_name }}
                                    </option>
                                @endforeach
                            </select>

                            @if ($manageZoomCategoryPermission == 'all')
                                <x-slot name="append">
                                    <button id="create_task_category" type="button"
                                            class="btn btn-outline-secondary border-grey">@lang('app.add')</button>
                                </x-slot>
                            @endif
                        </x-forms.input-group>
                    </div>


                    <div class="col-md-6 col-lg-3">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="colorselector" fieldRequired="true"
                                           :fieldLabel="__('modules.tasks.labelColor')">
                            </x-forms.label>
                            <x-forms.input-group id="colorpicker">
                                <input type="text" class="form-control height-35 f-14"
                                       placeholder="{{ __('placeholders.colorPicker') }}" name="label_color"
                                       id="colorselector" value="{{ $event->label_color }}">

                                <x-slot name="append">
                                    <span class="input-group-text height-35 colorpicker-input-addon"><i></i></span>
                                </x-slot>
                            </x-forms.input-group>
                        </div>
                    </div>

                    <div class="col-md-3 col-lg-3">
                        <x-forms.datepicker fieldId="start_date" fieldRequired="true"
                                            :fieldLabel="__('zoom::modules.zoommeeting.startOn')" fieldName="start_date"
                                            :fieldValue="$event->start_date_time->format($global->date_format)"
                                            :fieldPlaceholder="__('placeholders.date')"/>
                    </div>

                    <div class="col-md-3 col-lg-3">
                        <div class="bootstrap-timepicker timepicker">
                            <x-forms.text :fieldLabel="__('modules.employees.startTime')"
                                          :fieldPlaceholder="__('placeholders.hours')" fieldName="start_time"
                                          fieldId="start_time"
                                          fieldRequired="true"
                                          :fieldValue="$event->start_date_time->format($global->time_format)"/>
                        </div>
                    </div>

                    <div class="col-md-3 col-lg-3">
                        <x-forms.datepicker fieldId="end_date" fieldRequired="true"
                                            :fieldLabel="__('zoom::modules.zoommeeting.endOn')" fieldName="end_date"
                                            :fieldValue="$event->end_date_time->format($global->date_format)"
                                            :fieldPlaceholder="__('placeholders.date')"/>
                    </div>

                    <div class="col-md-3 col-lg-3">
                        <div class="bootstrap-timepicker timepicker">
                            <x-forms.text :fieldLabel="__('modules.employees.endTime')"
                                          :fieldPlaceholder="__('placeholders.hours')" fieldName="end_time"
                                          fieldId="end_time"
                                          fieldRequired="true"
                                          :fieldValue="$event->end_date_time->format($global->time_format)"/>
                        </div>
                    </div>

                    <div class="col-md-12">
                        <div class="form-group my-3">
                            <x-forms.textarea fieldId="description" :fieldValue="$event->description"
                                              :fieldLabel="__('app.description')" fieldName="description">
                            </x-forms.textarea>
                        </div>
                    </div>


                    <div class="col-md-6 col-lg-4">
                        <x-forms.select fieldId="project_id" :fieldLabel="__('app.project')" fieldName="project_id"
                                        search="true">
                            <option value="">--</option>
                            @foreach ($projects as $project)
                                <option @if ($project->id == $event->project_id) selected
                                        @endif value="{{ $project->id }}">
                                    {{ $project->project_name }}</option>
                            @endforeach
                        </x-forms.select>
                    </div>

                    <div class="col-md-6 col-lg-4">
                        <x-forms.select fieldId="selectEmployee" :fieldLabel="__('zoom::modules.meetings.addEmployees')"
                                        fieldName="employee_id[]" search="true" multiple="true">
                            @foreach ($employees as $emp)
                                <x-user-option :user="$emp" :selected="in_array($emp->id, $event->attendees->pluck('id')->toArray())"/>
                            @endforeach

                        </x-forms.select>
                    </div>

                    <div class="col-md-6 col-lg-4">
                        <x-forms.select fieldId="selectClient" :fieldLabel="__('zoom::modules.meetings.addClients')"
                                        fieldName="client_id[]" search="true" multiple="true">
                            @foreach ($clients as $emp)
                                <x-user-option :user="$emp" :selected="in_array($emp->id, $event->attendees->pluck('id')->toArray())"/>
                            @endforeach

                        </x-forms.select>
                    </div>


                    <div class="col-md-4">
                        <x-forms.select fieldId="created_by" :fieldLabel="__('zoom::modules.zoommeeting.meetingHost')"
                                        fieldName="created_by" search="true">
                            @foreach ($employees as $emp)
                                <x-user-option :user="$emp" :selected="$emp->id == $event->created_by"/>
                            @endforeach

                        </x-forms.select>
                    </div>

                    <div class="col-md-4">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="host_video"
                                           :fieldLabel="__('zoom::modules.zoommeeting.hostVideoStatus')"></x-forms.label>
                            <div class="d-flex">
                                <x-forms.radio fieldId="host_video1" :fieldLabel="__('app.enable')"
                                               fieldName="host_video" fieldValue="1"
                                               :checked="($event->host_video == 1)">
                                </x-forms.radio>
                                <x-forms.radio fieldId="host_video2" :fieldLabel="__('app.disable')" fieldValue="0"
                                               fieldName="host_video" :checked="($event->host_video == 0)">
                                </x-forms.radio>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="participant_video"
                                           :fieldLabel="__('zoom::modules.zoommeeting.participantVideoStatus')"></x-forms.label>
                            <div class="d-flex">
                                <x-forms.radio fieldId="participant_video1" :fieldLabel="__('app.enable')"
                                               fieldName="participant_video" fieldValue="1"
                                               :checked="($event->participant_video == 1)">
                                </x-forms.radio>
                                <x-forms.radio fieldId="participant_video2" :fieldLabel="__('app.disable')"
                                               fieldValue="0" fieldName="participant_video"
                                               :checked="($event->participant_video == 0)">
                                </x-forms.radio>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-12">
                            <div class="form-group">
                                <div class="d-flex mt-2">
                                    <x-forms.checkbox fieldId="repeat-event"
                                                      :fieldLabel="__('zoom::modules.zoommeeting.repeat')"
                                                      fieldName="repeat" fieldValue="1" :checked="($event->repeat == 1)"/>
                                </div>
                            </div>
                    </div>

                    <div class="col-lg-12 repeat-event-div">
                        <div class="row">
                            <div class="col-md-6">
                                <x-forms.select fieldId="repeat_type"
                                                :fieldLabel="__('zoom::modules.zoommeeting.recurrence')"
                                                fieldName="repeat_type">
                                    <option value="day" @if($event->repeat_type == 'day') selected @endif>@lang('app.daily')</option>
                                    <option value="week" @if($event->repeat_type == 'week') selected @endif>@lang('app.weekly')</option>
                                    <option value="month" @if($event->repeat_type == 'month') selected @endif>@lang('app.monthly')</option>
                                </x-forms.select>
                            </div>
                        </div>
                        <div id="daily-fields">
                            <div class="row">
                                <div class="col-sm-6">
                                    <x-forms.label class="mt-3" fieldId="repeat_every_daily"
                                                   :fieldLabel="__('zoom::modules.zoommeeting.repeatEvery')">
                                    </x-forms.label>
                                    <x-forms.input-group>
                                        <select class="form-control select-picker" name="repeat_every_daily"
                                                id="repeat_every_daily" data-size="8">
                                            @for ($i = 1; $i <= 15; $i++)
                                                <option>{{ $i }}</option>
                                            @endfor
                                        </select>
                                        <x-slot name="append">
                                            <span class="input-group-text bg-white border"
                                                  id="basic-addon2">@lang('app.day')</span>
                                        </x-slot>
                                    </x-forms.input-group>
                                </div>
                            </div>

                        </div>
                        <div id="weekly-fields" class="d-none">
                            <div class="row">
                                <div class="col-sm-6">
                                    <x-forms.select fieldId="repeat_every_weekly"
                                                    :fieldLabel="__('zoom::modules.zoommeeting.repeatEvery')"
                                                    fieldName="repeat_every_weekly" data-size="8">
                                        @for ($i = 1; $i <= 12; $i++)
                                            <option>{{ $i }}</option>
                                        @endfor
                                    </x-forms.select>
                                </div>
                                <div class="col-sm-6">
                                    <p class="mt-5">@lang('app.week')</p>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-sm-12 col-lg-6">
                                    <div class="form-group my-3">
                                        <x-forms.label fieldId="participant_video"
                                                       :fieldLabel="__('zoom::modules.zoommeeting.occursOn')"></x-forms.label>
                                        <div class="d-flex justify-content-between mt-2">
                                            <x-forms.checkbox :fieldLabel="now()->startOfWeek(7)->translatedFormat('l')" fieldName="occurs_on[]"
                                                              fieldId="open_sun" fieldValue="1"/>
                                            <x-forms.checkbox :fieldLabel="now()->startOfWeek(1)->translatedFormat('l')" fieldName="occurs_on[]"
                                                              fieldId="open_mon" fieldValue="2"/>
                                            <x-forms.checkbox :fieldLabel="now()->startOfWeek(2)->translatedFormat('l')" fieldName="occurs_on[]"
                                                              fieldId="open_tues" fieldValue="3"/>
                                            <x-forms.checkbox :fieldLabel="now()->startOfWeek(3)->translatedFormat('l')" fieldName="occurs_on[]"
                                                              fieldId="open_wed" fieldValue="4"/>
                                            <x-forms.checkbox :fieldLabel="now()->startOfWeek(4)->translatedFormat('l')" fieldName="occurs_on[]"
                                                              fieldId="open_thurs" fieldValue="5"/>
                                            <x-forms.checkbox :fieldLabel="now()->startOfWeek(5)->translatedFormat('l')" fieldName="occurs_on[]"
                                                              fieldId="open_fri" fieldValue="6"/>
                                            <x-forms.checkbox :fieldLabel="now()->startOfWeek(6)->translatedFormat('l')" fieldName="occurs_on[]"
                                                              fieldId="open_sat" fieldValue="7"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="monthly-fields" class="d-none">
                            <div class="row">
                                <div class="col-sm-6">
                                    <x-forms.select fieldId="repeat_every_monthly"
                                                    :fieldLabel="__('zoom::modules.zoommeeting.repeatEvery')"
                                                    fieldName="repeat_every_monthly">
                                        <option>1</option>
                                        <option>2</option>
                                        <option>3</option>
                                    </x-forms.select>
                                </div>
                                <div class="col-sm-6">
                                    <p class="mt-5">@lang('app.month')</p>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-sm-12">
                                    <div class="form-group my-3">
                                        <x-forms.label fieldId="occurs_on_monthly"
                                                       :fieldLabel="__('zoom::modules.zoommeeting.occursOn')"></x-forms.label>
                                    </div>
                                    <div class="input-group">
                                        <div class="input-group-prepend">
                                            <div class="input-group-text border-0 bg-white height-35">
                                                <input type="radio" checked id="occurs_on_monthly_day" value="day"
                                                       name="occurs_on_monthly">
                                            </div>
                                        </div>
                                        <label for="occurs_on_monthly_day">
                                            <select class="select-picker" data-size="8" name="occurs_month_day">
                                                @for ($i = 1; $i <= 31; $i++)
                                                    <option>{{ $i }}</option>
                                                @endfor
                                            </select>
                                            <span class="p-2">@lang('zoom::modules.zoommeeting.dayOfMonth')</span>
                                        </label>
                                    </div>
                                </div>

                                <div class="col-sm-12 mt-2">
                                    <div class="input-group">
                                        <div class="input-group-prepend">
                                            <div class="input-group-text border-0 bg-white height-35">
                                                <input type="radio" id="occurs_on_monthly_day2" value="when"
                                                       name="occurs_on_monthly">
                                            </div>
                                        </div>
                                        <label for="occurs_on_monthly_day2">
                                            <select class="select-picker" data-size="8" name="occurs_month_when">
                                                <option value="1">@lang('zoom::modules.zoommeeting.first')</option>
                                                <option value="2">@lang('zoom::modules.zoommeeting.second')
                                                </option>
                                                <option value="3">@lang('zoom::modules.zoommeeting.third')</option>
                                                <option value="4">@lang('zoom::modules.zoommeeting.fourth')</option>
                                                <option value="-1">@lang('zoom::modules.zoommeeting.last')</option>
                                            </select>

                                            <select class="select-picker" data-size="8" name="occurs_month_weekday">
                                                <option value="1">@lang('app.sunday')</option>
                                                <option value="2">@lang('app.monday')
                                                </option>
                                                <option value="3">@lang('app.tuesday')</option>
                                                <option value="4">@lang('app.wednesday')</option>
                                                <option value="5">@lang('app.thursday')</option>
                                                <option value="6">@lang('app.friday')</option>
                                                <option value="7">@lang('app.saturday')</option>
                                            </select>
                                            <span class="p-2">@lang('zoom::modules.zoommeeting.ofMonth')</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-sm-12">
                                <div class="form-group my-3">
                                    <x-forms.label fieldId="occurs_on_monthly" :fieldLabel="__('app.endDate')">
                                    </x-forms.label>
                                </div>
                                <div class="input-group">
                                    <div class="input-group-prepend">
                                        <div class="input-group-text border-0 bg-white height-35">
                                            <input type="radio" checked id="recurrence_end_date_date" value="date"
                                                   name="recurrence_end_date">
                                        </div>
                                    </div>
                                        <x-forms.datepicker fieldId="recurrence_end_dt" :fieldLabel="__('app.by')"
                                            fieldName="recurrence_end_date_date" :fieldPlaceholder="__('placeholders.date')" fieldRequired="true"
                                            :fieldValue="$event->end_date_time->format(company()->date_format)" />
                                </div>
                            </div>

                            <div class="col-sm-12 mt-2">
                                <div class="input-group">
                                    <div class="input-group-prepend">
                                        <div class="input-group-text border-0 bg-white height-35">
                                            <input type="radio" id="recurrence_end_date_after" value="times"
                                                   name="recurrence_end_date">
                                        </div>
                                    </div>
                                    <label for="recurrence_end_date_after">
                                        <span class="p-2">@lang('app.after')</span>

                                        <select class="select-picker" data-size="8" name="recurrence_end_date_after">
                                            @for ($i = 1; $i <= 20; $i++)
                                                <option>{{ $i }}</option>
                                            @endfor
                                        </select>

                                        <span class="p-2">@lang('zoom::modules.zoommeeting.occurrences')</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-12 my-3">
                        <x-forms.checkbox :fieldLabel="__('zoom::modules.zoommeeting.reminder')"
                                          fieldName="send_reminder" fieldId="send_reminder" fieldValue="1" :checked="($event->send_reminder)"/>
                    </div>

                    <div class="col-lg-12 send_reminder_div">
                        <div class="row">
                            <div class="col-lg-4">
                                <x-forms.number class="mr-0 mr-lg-2 mr-md-2"
                                                :fieldLabel="__('zoom::modules.zoommeeting.remindBefore')"
                                                fieldName="remind_time"
                                                fieldId="remind_time" fieldValue="1" fieldRequired="true"/>
                            </div>
                            <div class="col-md-4 mt-3">
                                <x-forms.select fieldId="remind_type" fieldLabel="" fieldName="remind_type"
                                                search="true">
                                    <option value="day" @if ($event->remind_type == 'day') selected @endif>@lang('app.day')</option>
                                    <option value="hour" @if ($event->remind_type == 'hour') selected @endif>@lang('app.hour')</option>
                                    <option value="minute" @if ($event->remind_type == 'minute') selected @endif>@lang('app.minute')</option>
                                </x-forms.select>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="w-100 border-top-grey d-flex justify-content-end px-4 py-3">
                    <x-forms.button-cancel :link="route('zoom-meetings.index')" class="border-0 mr-3">
                        @lang('app.cancel')
                    </x-forms.button-cancel>
                    <x-forms.button-primary id="save-event-form" icon="check">@lang('app.save')
                    </x-forms.button-primary>
                </div>

            </div>
        </x-form>

    </div>
</div>

<script src="{{ asset('vendor/jquery/bootstrap-colorpicker.js') }}"></script>

<script>
    $(document).ready(function () {
        @if ($event->repeat == 1)
        $('.repeat-event-div').show();
        @else
        $('.repeat-event-div').hide();
        @endif

        @if ($event->send_reminder == 1)
        $('.send_reminder_div').show();
        @else
        $('.send_reminder_div').hide();
        @endif
       $("#repeat-event").click(function() {
            $(".repeat-event-div").toggle();
        });

        $('#send_reminder').change(function () {
            $(".send_reminder_div").toggle();
        });

        $('#start_time, #end_time').timepicker({
            showMeridian: (company.time_format == 'H:i' ? false : true)
        });

        $('#colorpicker').colorpicker({
            "color": "{{ $event->label_color }}"
        });


        datepicker('#recurrence_end_dt', {
            position: 'bl',
            ...datepickerConfig
        });

        $("#selectEmployee, #selectClient").selectpicker({
            actionsBox: true,
            selectAllText: "{{ __('modules.permission.selectAll') }}",
            deselectAllText: "{{ __('modules.permission.deselectAll') }}",
            multipleSeparator: " ",
            selectedTextFormat: "count > 8"
        });

        const dp1 = datepicker('#start_date', {
            position: 'bl',
            dateSelected: new Date("{{ $event->start_date_time }}"),
            onSelect: (instance, date) => {
                if (typeof dp2.dateSelected !== 'undefined' && dp2.dateSelected.getTime() < date
                    .getTime()) {
                    dp2.setDate(date, true)
                }
                if (typeof dp2.dateSelected === 'undefined') {
                    dp2.setDate(date, true)
                }
                dp2.setMin(date);
            },
            ...datepickerConfig
        });

        const dp2 = datepicker('#end_date', {
            position: 'bl',
            dateSelected: new Date("{{ $event->end_date_time }}"),
            onSelect: (instance, date) => {
                dp1.setMax(date);
            },
            ...datepickerConfig
        });

        $('#save-event-form').click(function () {

            const url = "{{ route('zoom-meetings.update', $event->id) }}";

            $.easyAjax({
                url: url,
                container: '#save-event-data-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#save-event-form",
                data: $('#save-event-data-form').serialize(),
                success: function (response) {
                    if (response.status == 'success') {
                        if ($(MODAL_XL).hasClass('show')) {
                            $(MODAL_XL).modal('hide');
                            window.location.reload();
                        } else {
                            window.location.href = response.redirectUrl;
                        }
                    }
                }
            });
        });

        init(RIGHT_MODAL);
    });

</script>
