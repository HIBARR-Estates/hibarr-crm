<div class="row">
    <div class="col-md-12">
        <x-form id="update-meeting-data-form" method="PUT">
            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                    {{ $pageTitle }}</h4>
                <input type="hidden" name="meeting_id" value="{{ $meeting->id }}">
                <div class="row p-20">
                    <!-- Meeting Date Picker -->
                    <div class="col-md-4">
                        <x-forms.datepicker fieldId="meeting_date" fieldRequired="true"
                            :fieldLabel="__('performance::app.meetingDate')" fieldName="meeting_date"
                            :fieldValue="$meeting->start_date_time->format(company()->date_format)"
                            :fieldPlaceholder="__('placeholders.date')" />
                    </div>

                    <!-- Start Time Picker -->
                    <div class="col-md-4">
                        <div class="bootstrap-timepicker timepicker">
                            <x-forms.text :fieldLabel="__('modules.events.startOnTime')"
                                :fieldPlaceholder="__('placeholders.hours')" fieldName="start_time" fieldId="start_time"
                                fieldRequired="true"
                                :fieldValue="$meeting->start_date_time->format(company()->time_format)" />
                        </div>
                    </div>

                    <!-- End Time Picker -->
                    <div class="col-md-4">
                        <div class="bootstrap-timepicker timepicker">
                            <x-forms.text :fieldLabel="__('modules.events.endOnTime')"
                                :fieldPlaceholder="__('placeholders.hours')" fieldName="end_time" fieldId="end_time"
                                fieldRequired="true"
                                :fieldValue="$meeting->end_date_time->format(company()->time_format)" />
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
                                    <x-user-option :user="$item" :selected="$meeting->meeting_for == $item->id" />
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
                                    <x-user-option :user="$item" :selected="$meeting->meeting_by == $item->id" />
                                @endforeach
                            </select>
                        </x-forms.input-group>
                    </div>

                    <!-- Status -->
                    <div class="col-md-4">
                        <div class="form-group c-inv-select mb-4 my-3">
                            <x-forms.label fieldId="status" :fieldLabel="__('app.status')">
                            </x-forms.label>
                            <div class="select-others height-35 rounded">
                                <select class="form-control select-picker" data-live-search="true" data-size="8"
                                    name="status" id="status">
                                    <option data-content="<i class='fa fa-circle mr-1 f-15 text-yellow'></i> @lang('app.pending')" value="pending" @if ($meeting->status == 'pending') selected @endif></option>
                                    <option data-content="<i class='fa fa-circle mr-1 f-15 text-light-green'></i> @lang('app.completed')" value="completed" @if ($meeting->status == 'completed') selected @endif></option>
                                    <option data-content="<i class='fa fa-circle mr-1 f-15 text-red'></i> @lang('app.cancelled')" value="cancelled" @if ($meeting->status == 'cancelled') selected @endif></option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <x-form-actions>
                    <x-forms.button-primary id="update-meeting-form" class="mr-3 openRightModal"><i class="fa fa-check mr-1"></i> @lang('app.save')
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="route('meetings.index', ['tab' => $tab])" class="border-0">@lang('app.cancel')
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
        $('#meeting_for, #meeting_by').selectpicker();

        // Handle Repeat Options visibility
        $('#repeat-event').change(function() {
            $('.repeat-event-div').toggleClass('d-none');
            monthlyOn();
        });

        // Date Picker initialization
        const dp1 = datepicker('#meeting_date', {
            position: 'bl',
            onSelect: (instance, date) => {
                if (typeof dp2.dateSelected !== 'undefined' && dp2.dateSelected.getTime() < date.getTime()) {
                    dp2.setDate(date, true);
                }
                if (typeof dp2.dateSelected === 'undefined') {
                    dp2.setDate(date, true);
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
        $('#update-meeting-form').click(function() {
            $.easyAjax({
                url: "{{ route('meetings.update', $meeting->id) }}",
                container: '#update-meeting-data-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#update-meeting-form",
                data: $('#update-meeting-data-form').serialize(),
                success: function(response) {
                    if (response.status == 'success') {
                        let redirectUrl = response.redirectUrl;
                        window.location.href = redirectUrl;
                    }
                }
            });
        });

        monthlyOn();

        init(RIGHT_MODAL);
    });
</script>
