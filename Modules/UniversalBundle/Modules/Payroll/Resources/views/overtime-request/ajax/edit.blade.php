<link rel="stylesheet" href="https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css">

<style>
    .disabled {
            background-color: #F9D6D6; /* light red for disabled */
            color: #ccc; /* grey text for disabled */
            pointer-events: none; /* prevent click */
        }

</style>
<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('payroll::modules.payroll.updateRequest')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <x-form id="overtimeHoursUpdateForm" method="POST">

        <div class="form-body">
            <div class="row">
                <div class="col-lg-8">
                    <x-employee :user="$overtimeRequest->user"/>
                    <input type="hidden" value="{{ $overtimeRequest->user->id }}" name="user_id" id="user_id">
                </div>
            </div>

                <div class="pt-20 pr-20 row">
                    <div class="col-lg-3">
                        <x-forms.text class="date-picker" :fieldLabel="__('app.date')" fieldName="date"
                            fieldId="dateField" :fieldPlaceholder="__('app.date')" fieldValue="{{ $overtimeRequest->date->format(company()->date_format) }}"
                            fieldRequired="true" />
                    </div>
                      <!-- Overtime Type Field -->
                      <div class="col-md-3">
                        <div class="form-group mt-4">
                            <label class="f-14 text-dark-grey mb-1">
                                @lang('payroll::modules.payroll.overtimeType') <span class="text-danger">*</span>
                            </label>
                            <select name="type"
                                    id="type"
                                    data-live-search="true"
                                    class="form-control select-picker"
                                    data-size="8">
                                @if($userPolicy->working_days == 1)
                                    <option @if($overtimeRequest->type == 'working') selected @endif value="working">@lang('payroll::modules.payroll.workingDay')</option>
                                @endif
                                @if($userPolicy->week_end == 1)
                                    <option @if($overtimeRequest->type == 'dayoff') selected @endif value="dayoff">@lang('payroll::modules.payroll.dayOff')</option>
                                @endif
                                @if($userPolicy->holiday == 1)
                                    <option @if($overtimeRequest->type == 'holiday') selected @endif value="holiday">@lang('payroll::modules.payroll.holiday')</option>
                                @endif
                            </select>
                        </div>
                    </div>

                    <div class="col-md-3 col-lg-3" id="set-time-estimate-fields">
                        <div class="form-group mt-5">
                            <input type="number" min="0" class="w-25 border rounded p-2 height-35 f-14"
                                   name="overtime_hours" value="{{ $overtimeRequest->hours }}">
                            @lang('app.hrs')
                            &nbsp;&nbsp;
                            <input type="number" min="0" name="minutes"
                                   value="{{ $overtimeRequest->minutes }}"
                                   class="w-25 height-35 f-14 border rounded p-2">
                            @lang('app.mins')
                        </div>
                    </div>

                    <div class="col-lg-4">
                        <div class="my-3 form-group">
                            <x-forms.text :fieldLabel="__('app.reason')" fieldName="overtime_reasons"
                                fieldId="overtime_reasons" :fieldPlaceholder="__('app.reason')" fieldValue="{{ $overtimeRequest->overtime_reason }}"
                                fieldRequired="false" />
                        </div>
                    </div>


                </div>

                <div id="insertBefore"></div>

                <!--  ADD ITEM START-->

            <input type="hidden" name="start_date" id="start_date" value="">
            <input type="hidden" name="end_date" id="end_date" value="">

        </div>
    </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="save-request" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.min.js"></script>

<script>
    $(".select-picker").selectpicker();
    var applyDate = "{{ $policyData['applyDate']->format('Y-m-d') }}";
    var lastDate = "{{ $policyData['currentMonthDate']->format('Y-m-d') }}";

    applyDate = new Date(applyDate);
    lastDate = new Date(lastDate);

    datepicker('#dateField', {
        position: 'bl',
        minDate: applyDate,
        maxDate: lastDate,
        ...datepickerConfig
    });

    // save request
    $('#save-request').click(function (e) {
        e.preventDefault();

        var url = "{{ route('overtime-requests.update', $overtimeRequest->id) }}";

        $.easyAjax({
            url: url,
            container: '#overtimeHoursUpdateForm',
            type: "PUT",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#save-request",
            data: $('#overtimeHoursUpdateForm').serialize(),
            success: function (response) {
                if (response.status == "success") {
                    $(MODAL_LG).modal('hide');
                }
                showTable();
            }
        })
    });


</script>
