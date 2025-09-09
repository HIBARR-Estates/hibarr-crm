<style>
    .custom-label-class {
        width: 20%; /* Adjust the label width */
    }

    .custom-value-class {
        width: 80%; /* Adjust the value width */
    }
</style>
<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('modules.lead.addFollowUp')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="followUpForm" method="POST" class="ajax-form">
            <div class="form-body">
                <div class="row">

                    <div class="col-md-12">
                        <x-cards.data-row :label="__('modules.lead.clientName')" :value="$deal->contact->client_name_salutation ?? '--'"
                            labelClasses="custom-label-class"  otherClasses="custom-value-class" />
                    </div>

                    <div class="col-md-6">
                        <x-forms.datepicker fieldId="next_follow_up_date" fieldRequired="true"
                            :fieldLabel="__('modules.lead.leadFollowUp')" fieldName="next_follow_up_date"
                            :fieldValue="now(company()->timezone)->addMinutes(5)->format(company()->date_format)"
                            :fieldPlaceholder="__('placeholders.date')" />
                    </div>
                    <div class="col-md-6">
                        <div class="bootstrap-timepicker timepicker">
                            <x-forms.text :fieldLabel="__('modules.timeLogs.startTime')" :fieldPlaceholder="__('placeholders.hours')"
                                fieldName="start_time" fieldId="start_time" fieldRequired="true"
                                :fieldValue="now(company()->timezone)->addMinutes(30)->format(company()->time_format)" />
                        </div>
                    </div>
                    <div class="col-md-6">
                        <x-forms.select fieldId="meeting_type_id" :fieldLabel="__('Meeting Type')" fieldName="meeting_type_id"
                            search="true">
                            <option value="">-- Select Meeting Type --</option>
                            @foreach (\App\Models\MeetingType::where('company_id', company()->id)->get() as $meetingType)
                                <option value="{{ $meetingType->id }}" data-color="{{ $meetingType->color }}">
                                    {{ $meetingType->name }}
                                </option>
                            @endforeach
                        </x-forms.select>
                    </div>
                    <div class="col-md-6">
                        <x-forms.select fieldId="location" :fieldLabel="__('Meeting Location')" fieldName="location"
                            search="true">
                            <option value="office">Office</option>
                            <option value="zoom">Zoom</option>
                            <option value="zoho_meet">Zoho Meet</option>
                            <option value="google_meet">Google Meet</option>
                        </x-forms.select>
                    </div>
                    <div class="col-md-12">
                        <div class="form-group my-3">
                            <x-forms.textarea class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('modules.lead.remark')"
                                fieldName="remark" fieldId="remark" fieldPlaceholder="">
                            </x-forms.textarea>
                        </div>
                    </div>

                    <div class="col-lg-12 my-3">
                        <div class="row align-items-center">
                            <div class="col-md-5">
                                <x-forms.checkbox :fieldLabel="__('modules.tasks.reminder')" fieldName="send_reminder"
                                    fieldId="send_reminder" fieldValue="yes" fieldRequired="true" />
                            </div>
                            <div class="col-md-7">
                                <div id="reminder-label" class="text-right" style="display: none;">
                                    <i class="fa fa-info-circle"></i> You will receive a reminder 30 minutes before your meeting
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-12 send_reminder_div d-none">
                        <div class="row">
                            <div class="col-lg-6 mt-1">
                                <x-forms.number class="mr-0 mr-lg-2 mr-md-2"
                                    :fieldLabel="__('modules.events.remindBefore')" fieldName="remind_time"
                                    fieldId="remind_time" fieldValue="15" fieldRequired="true" />
                            </div>
                            <div class="col-md-6 mt-3">
                                <x-forms.select fieldId="remind_type" fieldLabel="" fieldName="remind_type"
                                    search="true">
                                    <option value="day">@lang('app.day')</option>
                                    <option value="hour">@lang('app.hour')</option>
                                    <option value="minute" selected>@lang('app.minute')</option>
                                </x-forms.select>
                            </div>
                        </div>
                    </div>
                    
                </div>
            </div>
            <input type="hidden" name="deal_id" value="{{ $dealID }}">
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="save-followup" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script>
    $(document).ready(function() {

        $(".select-picker").selectpicker();

        $('#start_time').timepicker({
            @if (company()->time_format == 'H:i')
                showMeridian: false,
            @endif
        });

        const dp11 = datepicker('#next_follow_up_date', {
            position: 'bl',
            ...datepickerConfig
        });
        dp11.setMin(new Date())

        $('#send_reminder').change(function() {
            if ($(this).is(':checked')) {
                $('.send_reminder_div').addClass('d-none');
                $('#reminder-label').show();
            } else {
                $('.send_reminder_div').addClass('d-none');
                $('#reminder-label').hide();
            }
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

        // save channel
        $('#save-followup').click(function() {
            // Validate all required fields first
            const start_time = $('#start_time').val();
            const next_follow_up_date = $('#next_follow_up_date').val();
            const meeting_type_id = $('#meeting_type_id').val();
            const location = $('#location').val();
            const meetingTypeText = $('#meeting_type_id option:selected').text().toLowerCase();
            
            // Validate start time
            if(!start_time || start_time.trim() === '') {
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Start time is required',
                });
                return false;
            }
            
            // Validate next follow up date
            if(!next_follow_up_date || next_follow_up_date.trim() === '') {
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Next follow up date is required',
                });
                return false;
            }
            
            // Validate meeting type
            if(!meeting_type_id || meeting_type_id === '') {
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Meeting type is required',
                });
                return false;
            }
            
            // Validate location
            if(!location || location.trim() === '') {
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Location is required',
                });
                return false;
            }
            
            // Check if start time is in the future
            const now = new Date();
            const startTime = new Date(next_follow_up_date + ' ' + start_time);
            
            if(startTime <= now) {
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Start time must be in the future',
                });
                return false;
            }
            
            // Check if follow up date is not in the past
            const followUpDate = new Date(next_follow_up_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if(followUpDate < today) {
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Follow up date cannot be in the past',
                });
                return false;
            }
          
            $.easyAjax({
                url: "{{ route('deals.follow_up_store') }}",
                container: '#followUpForm',
                type: "POST",
                blockUI: true,
                messagePosition: 'toastr',
                data: $('#followUpForm').serialize(),
                success: function(response) {
                    if (response.status == "success") {
                        window.location.reload();
                    }
                }
            })
        });
    });
</script>


