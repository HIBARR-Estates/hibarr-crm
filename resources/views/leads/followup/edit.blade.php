    <div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('modules.lead.editFollowUp')</h5>
    <button type="button"  class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">

        <x-form id="followUpForm" method="POST" class="ajax-form">
            <input type="hidden" name="deal_id" value="{{ $follow->lead_id }}">
            <input type="hidden" name="id" value="{{ $follow->id }}">
            <div class="form-body">
                <div class="row">

                    <div class="col-md-6">
                        <x-forms.datepicker fieldId="next_follow_up_date" fieldRequired="true"
                            :fieldLabel="__('modules.lead.leadFollowUp')" fieldName="next_follow_up_date"
                            :fieldValue="$follow->next_follow_up_date->format(company()->date_format)"
                            :fieldPlaceholder="__('placeholders.date')" />
                    </div>
                    <div class="col-md-6">
                        <div class="bootstrap-timepicker timepicker">
                            <x-forms.text fieldLabel="Start Time" :fieldPlaceholder="__('placeholders.hours')" fieldName="start_time" fieldId="start_time" fieldRequired="true" :fieldValue="$follow->next_follow_up_date->format(company()->time_format)"/>
                        </div>
                    </div>

                    <div class="col-md-12">
                        <x-forms.select fieldId="meeting_type_id" :fieldLabel="__('Meeting Type')" fieldName="meeting_type_id"
                            search="true">
                            <option value="">-- Select Meeting Type --</option>
                            @foreach (\App\Models\MeetingType::where('company_id', company()->id)->get() as $meetingType)
                                <option value="{{ $meetingType->id }}" data-color="{{ $meetingType->color }}" {{ $follow->meeting_type_id == $meetingType->id ? 'selected' : '' }}>
                                    {{ $meetingType->name }}
                                </option>
                            @endforeach
                        </x-forms.select>
                    </div>
                    <div class="col-md-12">
                        <x-forms.select fieldId="location" :fieldLabel="__('Location')" fieldName="location"
                            search="true">
                            <option value="office" {{ $follow->location == 'office' ? 'selected' : '' }}>Office</option>
                            <option value="zoom" {{ $follow->location == 'zoom' ? 'selected' : '' }}>Zoom</option>
                            <option value="zoho_meet" {{ $follow->location == 'zoho_meet' ? 'selected' : '' }}>Zoho Meet</option>
                            <option value="google_meet" {{ $follow->location == 'google_meet' ? 'selected' : '' }}>Google Meet</option>
                        </x-forms.select>
                    </div>
                    <div class="col-md-12" id="meeting_link_container" style="display: {{ $follow->location != 'office' ? 'block' : 'none' }};">
                        <x-forms.text :fieldLabel="__('Meeting Link')" fieldName="meeting_link" fieldId="meeting_link"
                            :fieldPlaceholder="__('Enter meeting link')" :fieldValue="$follow->meeting_link" />
                    </div>

                    <div class="col-md-12">
                        <div class="row">
                            <div class="col-md-6 mb-2">
                                <x-forms.select fieldId="status" :fieldLabel="__('modules.employees.status')" fieldName="status" search="true">
                                        {{-- Values must match the lead_follow_up.status enum
                                             (scheduled|completed|cancelled). They read
                                             'pending'/'canceled' before, so saving this form
                                             wrote a value the column rejects. --}}
                                        <option value="scheduled"  @selected($follow->status == 'scheduled')  data-content="<i class='fa fa-circle mr-2 text-warning'></i> @lang('app.scheduled') " >@lang('app.scheduled')</option>
                                        <option value="cancelled" @selected($follow->status == 'cancelled') data-content="<i class='fa fa-circle mr-2 text-red'></i> @lang('app.cancelled') " >@lang('app.cancelled')</option>
                                        <option value="completed" @selected($follow->status == 'completed') data-content="<i class='fa fa-circle mr-2 text-dark-green'></i> @lang('app.completed') " >@lang('app.completed')</option>
                                    </x-forms.select>
                            </div>

                            <div class="col-md-6 mt-5">
                                <x-forms.checkbox :fieldLabel="__('modules.tasks.reminder')" fieldName="send_reminder"
                                    fieldId="send_reminder" fieldValue="yes" fieldRequired="true"
                                    :checked="$follow->send_reminder == 'yes'" />
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-12 send_reminder_div @if ($follow->send_reminder == null) d-none @endif">
                        <div class="row">
                            <div class="col-lg-6 mt-1">
                                <x-forms.number class="mr-0 mr-lg-2 mr-md-2"
                                    :fieldLabel="__('modules.events.remindBefore')" fieldName="remind_time"
                                    fieldId="remind_time" :fieldValue="$follow->remind_time" fieldRequired="true" />
                            </div>
                            <div class="col-md-6 mt-3">
                                <x-forms.select fieldId="remind_type" fieldLabel="" fieldName="remind_type"
                                    search="true">
                                    <option @selected($follow->remind_type == 'day') value="day">@lang('app.day')</option>
                                    <option @selected($follow->remind_type == 'hour') value="hour">@lang('app.hour')</option>
                                    <option @selected($follow->remind_type == 'minute') value="minute">@lang('app.minute')
                                    </option>
                                </x-forms.select>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-12">
                        <div class="form-group my-3">
                            <x-forms.textarea class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('modules.lead.remark')"
                                fieldName="remark" fieldId="remark"
                                fieldPlaceholder="" :fieldValue="$follow->remark">
                            </x-forms.textarea>
                        </div>
                    </div>
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="save-followup" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script>

    $(".select-picker").selectpicker();

    $('#start_time').timepicker({
            @if (company()->time_format == 'H:i')
                showMeridian: false,
            @endif
        });

    var dp1 = datepicker('#next_follow_up_date', {
        position: 'bl',
        dateSelected: new Date("{{ str_replace('-', '/', $follow->next_follow_up_date) }}"),
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

    $('#send_reminder').change(function() {
            $('.send_reminder_div').toggleClass('d-none');
        })

    // Show/hide meeting link field based on location selection
    $('#location').change(function() {
        var location = $(this).val();
        if (location === 'office') {
            $('#meeting_link_container').hide();
            $('#meeting_link').val('');
        } else {
            $('#meeting_link_container').show();
        }
    });

    // save followup
    $('#save-followup').click(function() {
        $.easyAjax({
            url: "{{ route('deals.follow_up_update') }}",
            container: '#followUpForm',
            type: "POST",
            blockUI: true,
            data: $('#followUpForm').serialize(),
            success: function(response) {
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        })
    });

</script>
