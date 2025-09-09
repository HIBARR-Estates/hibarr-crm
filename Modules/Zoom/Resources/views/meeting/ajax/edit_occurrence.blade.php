<div class="row">
    <div class="col-sm-12">
        <x-form id="save-event-data-form">
            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                    @lang('zoom::modules.zoommeeting.editMeeting')</h4>
                <div class="row p-20">

                    <div class="col-md-12">
                        <h3 class="heading-h1 mb-3">{{ ($event->meeting_name) }}</h3>
                    </div>

                    <div class="col-md-12 mt-3">
                        <x-forms.label fieldId="description" :fieldLabel="__('app.description')">
                        </x-forms.label>
                        <p>{{ $event->description ?? '--' }}</p>
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
                                          :fieldPlaceholder="__('placeholders.hours')"
                                          :fieldValue="$event->start_date_time->format($global->time_format)"
                                          fieldName="start_time" fieldId="start_time" fieldRequired="true"/>
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
                                          :fieldPlaceholder="__('placeholders.hours')"
                                          :fieldValue="$event->end_date_time->format($global->time_format)"
                                          fieldName="end_time"
                                          fieldId="end_time" fieldRequired="true"/>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <x-forms.select fieldId="created_by" :fieldLabel="__('zoom::modules.zoommeeting.meetingHost')"
                                        fieldName="created_by" search="true">
                            @foreach ($employees as $emp)
                                <x-user-option :user="$emp" :selected="$emp->id == $event->created_by"/>
                            @endforeach

                        </x-forms.select>
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

<script>
    $(document).ready(function () {

        $('#start_time, #end_time').timepicker({
            showMeridian: (company.time_format == 'H:i' ? false : true)
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

            const url = "{{ route('zoom-meetings.update_occurrence', $event->id) }}";

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
