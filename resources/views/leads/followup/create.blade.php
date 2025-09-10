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
                            :fieldValue="now(company()->timezone)->format(company()->date_format)"
                            :fieldPlaceholder="__('placeholders.date')" />
                    </div>
                    <div class="col-md-6">
                        <div class="bootstrap-timepicker timepicker">
                            <x-forms.text :fieldLabel="__('Meeting Start Time')" :fieldPlaceholder="__('placeholders.hours')"
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
                            <x-forms.textarea class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('Meeting Remark')"
                                fieldName="remark" fieldId="remark" fieldPlaceholder="">
                            </x-forms.textarea>
                        </div>
                    </div>
                    <div class="col-lg-12 my-3">
                        <div class="row">
                            <div class="col-lg-6">
                                <x-forms.checkbox :fieldLabel="__('modules.tasks.reminder')" fieldName="send_reminder"
                                    fieldId="send_reminder" fieldValue="yes" fieldRequired="true" />
                            </div>
                            <div class="col-lg-6 reminder_info d-none">
                                <i class="fa fa-info-circle"></i> You will be reminded 30mins before the meeting starts
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-4 send_reminder_div d-none">
                        <div class="row">
                            <div class="col-lg-6 mt-1">
                                <x-forms.number class="mr-0 mr-lg-2 mr-md-2"
                                    :fieldLabel="__('modules.events.remindBefore')" fieldName="remind_time"
                                    fieldId="remind_time" fieldValue="30" fieldRequired="true" />
                            </div>
                            <div class="col-md-4 mt-3">
                                <x-forms.select fieldId="remind_type" fieldLabel="" fieldName="remind_type"
                                    search="true">
                                    <option value="day">@lang('app.day')</option>
                                    <option value="hour">@lang('app.hour')</option>
                                    <option value="minute">@lang('app.minute')</option>
                                    <option value="minute" selected>minute</option>
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
            $('.reminder_info').toggleClass('d-none');
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

        // Validation function
        function validateFollowUpForm() {
            let isValid = true;
            let errorMessage = '';

            // Validate Meeting Type
            const meetingType = $('#meeting_type_id').val();
            if (!meetingType || meetingType === '') {
                isValid = false;
                errorMessage += 'Please select a meeting type.\n';
                $('#meeting_type_id').addClass('is-invalid');
            } else {
                $('#meeting_type_id').removeClass('is-invalid');
            }

            // Validate Start Time
            const startTime = $('#start_time').val();
            const followUpDate = $('#next_follow_up_date').val();
            
            if (!startTime || startTime.trim() === '') {
                isValid = false;
                errorMessage += 'Please enter a start time.\n';
                $('#start_time').addClass('is-invalid');
            } else if (followUpDate) {
                // Check if the selected date and time is in the future
                const selectedDateTime = new Date(followUpDate + ' ' + startTime);
                const now = new Date();
                
                if (selectedDateTime <= now) {
                    isValid = false;
                    errorMessage += 'Please select a time in the future.\n';
                    $('#start_time').addClass('is-invalid');
                } else {
                    $('#start_time').removeClass('is-invalid');
                }
            } else {
                $('#start_time').removeClass('is-invalid');
            }

            // Validate Follow-up Date
            if (!followUpDate || followUpDate.trim() === '') {
                isValid = false;
                errorMessage += 'Please select a follow-up date.\n';
                $('#next_follow_up_date').addClass('is-invalid');
            } else {
                $('#next_follow_up_date').removeClass('is-invalid');
            }

            // Show error message if validation fails
            if (!isValid) {
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: errorMessage.trim(),
                    customClass: {
                        confirmButton: 'btn btn-primary',
                    },
                    showClass: {
                        popup: 'swal2-noanimation',
                        backdrop: 'swal2-noanimation',
                    },
                });
            }

            return isValid;
        }

        // Real-time validation
        $('#meeting_type_id, #start_time, #next_follow_up_date').on('change blur', function() {
            $(this).removeClass('is-invalid');
            
            // Validate individual fields
            if ($(this).attr('id') === 'meeting_type_id') {
                if (!$(this).val() || $(this).val() === '') {
                    $(this).addClass('is-invalid');
                }
            }
            
            if ($(this).attr('id') === 'start_time') {
                const timeValue = $(this).val();
                const followUpDate = $('#next_follow_up_date').val();
                
                if (!timeValue || timeValue.trim() === '') {
                    $(this).addClass('is-invalid');
                } else if (followUpDate) {
                    // Check if the selected date and time is in the future
                    const selectedDateTime = new Date(followUpDate + ' ' + timeValue);
                    const now = new Date();
                    
                    if (selectedDateTime <= now) {
                        $(this).addClass('is-invalid');
                    }
                }
            }
            
            if ($(this).attr('id') === 'next_follow_up_date') {
                if (!$(this).val() || $(this).val().trim() === '') {
                    $(this).addClass('is-invalid');
                }
            }
        });

        // save channel
        $('#save-followup').click(function(e) {
            e.preventDefault();
            
            // Validate form before submitting
            if (!validateFollowUpForm()) {
                return false;
            }

            $.easyAjax({
                url: "{{ route('deals.follow_up_store') }}",
                container: '#followUpForm',
                type: "POST",
                blockUI: true,
                data: $('#followUpForm').serialize(),
                success: function(response) {
                    if (response.status == "success") {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success!',
                            text: 'Follow-up created successfully. ',
                            customClass: {
                                confirmButton: 'btn btn-primary',
                            },
                            showClass: {
                                popup: 'swal2-noanimation',
                                backdrop: 'swal2-noanimation',
                            },
                        });
                    }
                },
                error: function(xhr) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error!',
                        text: 'Failed to create follow-up. Please try again.',
                        customClass: {
                            confirmButton: 'btn btn-primary',
                        },
                        showClass: {
                            popup: 'swal2-noanimation',
                            backdrop: 'swal2-noanimation',
                        },
                    });
                }
            })
        });
    });
</script>

<style>
    /* Only apply validation styles to input fields, not dropdowns */
    input.is-invalid, 
    textarea.is-invalid {
        border-color: #dc3545 !important;
        box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25) !important;
    }
    
    input.is-invalid:focus, 
    textarea.is-invalid:focus {
        border-color: #dc3545 !important;
        box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25) !important;
    }
    
    .form-group .is-invalid + .invalid-feedback {
        display: block;
        color: #dc3545;
        font-size: 0.875rem;
        margin-top: 0.25rem;
    }
</style>
