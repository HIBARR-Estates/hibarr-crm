<div class="row">
    <div class="col-md-12">
        <x-form id="save-meeting-data-form">
            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                    {{ $pageTitle }}</h4>
                <input type="hidden" name="tab" value="{{ $tab }}">
                <div class="row p-20">
                    <!-- Meeting Date Picker -->
                    <div class="col-md-4">
                        <x-forms.datepicker fieldId="meeting_date" fieldRequired="true" :fieldLabel="__('performance::app.meetingDate')"
                            fieldName="meeting_date" :fieldValue="now(company()->timezone)->format(company()->date_format)" :fieldPlaceholder="__('placeholders.date')" />
                    </div>

                    <!-- Start Time Picker -->
                    <div class="col-md-4">
                        <div class="bootstrap-timepicker timepicker">
                            <x-forms.text :fieldLabel="__('modules.events.startOnTime')" :fieldPlaceholder="__('placeholders.hours')" fieldName="start_time"
                                fieldId="start_time" fieldRequired="true" />
                        </div>
                    </div>

                    <!-- End Time Picker -->
                    <div class="col-md-4">
                        <div class="bootstrap-timepicker timepicker">
                            <x-forms.text :fieldLabel="__('modules.events.endOnTime')" :fieldPlaceholder="__('placeholders.hours')" fieldName="end_time" fieldId="end_time"
                                fieldRequired="true" />
                        </div>
                    </div>

                    <!-- Meeting For -->
                    <div class="col-md-4">
                        <x-forms.label class="mt-3" fieldId="meeting_for" :fieldLabel="__('performance::app.meetingFor')" fieldRequired="true">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="meeting_for" id="meeting_for"
                                data-live-search="true" data-size="8">
                                <option value="">--</option>
                                @foreach ($employees as $item)
                                    <x-user-option :user="$item" />
                                @endforeach
                            </select>
                        </x-forms.input-group>
                    </div>

                    <!-- Meeting By -->
                    <div class="col-md-4">
                        <x-forms.label class="mt-3" fieldId="meeting_by" :fieldLabel="__('performance::app.meetingBy')" fieldRequired="true">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="meeting_by" id="meeting_by"
                                data-live-search="true" data-size="8">
                                <option value="">--</option>
                                @foreach ($employees as $item)
                                    <x-user-option :user="$item" />
                                @endforeach
                            </select>
                        </x-forms.input-group>
                    </div>

                    <!-- Repeat Options -->
                    <div class="col-md-4 mt-5">
                        <x-forms.checkbox :fieldLabel="__('modules.events.repeat')" fieldName="repeat" fieldId="repeat-event" fieldValue="yes"
                            fieldRequired="true" />
                    </div>

                    <div class="col-md-12 mt-3 repeat-event-div d-none">
                        <div class="row">
                            <div class="col-lg-4">
                                <x-forms.number class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('modules.events.repeatEvery')" fieldName="repeat_count"
                                    fieldId="repeat_count" fieldValue="1" fieldRequired="true" />
                            </div>

                            <!-- Repeat Frequency -->
                            <div class="col-md-4 mt-3">
                                <x-forms.select fieldId="repeat_type" fieldLabel="" fieldName="repeat_type"
                                    search="true">
                                    <option value="day">@lang('app.day')</option>
                                    <option value="week">@lang('app.week')</option>
                                    <option value="month">@lang('app.month')</option>
                                    <option id="monthlyOn" value="monthly-on-same-day">@lang('app.eventMonthlyOn', ['week' => __('app.eventDay.' . now()->weekOfMonth), 'day' => now()->translatedFormat('l')])</option>
                                    <option value="year">@lang('app.year')</option>
                                </x-forms.select>
                            </div>

                            <!-- Repeat Cycles -->
                            <div class="col-lg-4 col-md-4">
                                <x-forms.text :fieldLabel="__('modules.events.cycles')" fieldName="repeat_cycles" fieldRequired="true"
                                    fieldId="repeat_cycles" fieldPlaceholder="" />
                            </div>
                        </div>
                    </div>
                </div>

                <x-form-actions>
                    <x-forms.button-primary id="save-meeting-form" class="mr-3 openRightModal">@lang('app.next') <i class="fa fa-arrow-right ml-1"></i>
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="route('meetings.index')" class="border-0">@lang('app.cancel')
                    </x-forms.button-cancel>
                </x-form-actions>
            </div>
        </x-form>
    </div>
</div>

<script>
    $(document).ready(function() {

        function monthlyOn() {
            let ele = $('#monthlyOn');
            let url = '{{ route('meetings.monthly_on') }}';
            setTimeout(() => {
                $.easyAjax({
                    url: url,
                    type: "POST",
                    data: {
                        _token: "{{ csrf_token() }}",
                        date: $('#meeting_date').val()
                    },
                    success: function(response) {
                        @if (App::environment('development'))
                            $('#event_name').val(response.message);
                        @endif
                        ele.html(response.message);
                        $('#repeat_type').selectpicker('refresh');
                    }
                });
            }, 100);
        }

        // Select initialization
        $('#meeting_for').selectpicker();

        // Handle Repeat Options visibility
        $('#repeat-event').change(function() {
            $('.repeat-event-div').toggleClass('d-none');
            monthlyOn();
        })

        // Date Picker initialization
        const dp1 = datepicker('#meeting_date', {
            position: 'bl',
            onSelect: (instance, date) => {
                if (typeof dp2.dateSelected !== 'undefined' && dp2.dateSelected.getTime() < date
                    .getTime()) {
                    dp2.setDate(date, true)
                }
                if (typeof dp2.dateSelected === 'undefined') {
                    dp2.setDate(date, true)
                }
                dp2.setMin(date);
                monthlyOn();
            },
            ...datepickerConfig
        });

        // Time Picker initialization
        $('#start_time, #end_time').timepicker({
            @if (company()->time_format == 'H:i')
                showMeridian: false,
            @endif
        });

        // Submit Meeting Form
        $('#save-meeting-form').click(function() {
            $.easyAjax({
                url: "{{ route('meetings.store') }}",
                container: '#save-meeting-data-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#save-meeting-form",
                data: $('#save-meeting-data-form').serialize(),
                success: function(response) {
                    if (response.status == 'success') {
                        const meetingId = response.meeting_id;
                        const tab = response.tab;

                        let redirectUrl = "{{ route('agenda.create') }}?meetingId="+meetingId+"&tab="+tab;
                        window.location.href = redirectUrl;
                    }
                }
            });
        });

        monthlyOn();

        init(RIGHT_MODAL);
    });
</script>
