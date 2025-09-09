<link rel="stylesheet" href="https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css">

<style>
    .disabled {
            background-color: #F9D6D6; /* light red for disabled */
            color: #ccc; /* grey text for disabled */
            pointer-events: none; /* prevent click */
        }

</style>
<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('payroll::modules.payroll.addRequest')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <x-form id="overtimeHoursForm" method="POST">

        <div class="form-body">
            <div class="row">
                <div class="col-lg-8">
                    @if (user()->hasRole('admin'))

                    <x-forms.label fieldId="employee" :fieldLabel="__('app.employee')" :fieldRequired="true"
                    class="mt-3"> </x-forms.label>
                    <i class="fa fa-question-circle" data-toggle="tooltip" data-original-title="{{__('payroll::messages.onlyEmployeesShow')}}"></i>

                    <select name="employee" id="employee" data-live-search="true" class="form-control select-picker" data-size="8">
                         <option value="">--</option>
                            @foreach ($employees as $employee)
                                <x-user-option :user="$employee" :selected="request()->has('default_assign') &&
                                    request('default_assign') == $employee->id" />
                            @endforeach
                    </select>

                    @else
                        <x-employee :user="user()"/>
                        <input type="hidden" value="{{ user()->id }}" name="employee" id="employee">
                    @endif
                </div>
            </div>

                {{-- <div class="pt-20 pr-20 row">
                    <div class="col-lg-3">
                        <x-forms.text class="date-picker" :fieldLabel="__('app.date')" fieldName="date[]"
                            fieldId="dateField1" :fieldPlaceholder="__('app.date')" fieldValue=""
                            fieldRequired="true" />
                    </div>
                    <div class="col-lg-3">
                        <x-forms.label fieldId="type" :fieldLabel="__('payroll::modules.payroll.OvertimeType')" :fieldRequired="true"
                        class="mt-3"> </x-forms.label>
                        <select name="type[]" id="type" data-live-search="true" class="form-control select-picker" data-size="8">
                            <option value="working_day">@lang('payroll::modules.payroll.workingDay')</option>
                            <option value="day_off">@lang('payroll::modules.payroll.dayOff')</option>
                            <option value="holiday">@lang('payroll::modules.payroll.Holiday')</option>
                        </select>
                    </div>

                    <div class="col-md-3 col-lg-3" id="set-time-estimate-fields">
                        <div class="form-group mt-5">
                            <input type="number" min="0" class="w-25 border rounded p-2 height-35 f-14"
                                   name="overtime_hours[]" value="">
                            @lang('app.hrs')
                            &nbsp;&nbsp;
                            <input type="number" min="0" name="minutes[]"
                                   value=""
                                   class="w-25 height-35 f-14 border rounded p-2">
                            @lang('app.mins')
                        </div>
                    </div>

                    <div class="col-lg-4">
                        <div class="my-3 form-group">
                            <x-forms.text :fieldLabel="__('app.reason')" fieldName="overtime_reasons[]"
                                fieldId="overtime_reasons" :fieldPlaceholder="__('app.reason')" fieldValue=""
                                fieldRequired="false" />
                        </div>
                    </div>


                </div> --}}
                <div class="row pt-5 pb-3">
                    <!-- Date Field -->
                    <div class="col-md-2">
                        <div class="form-group">
                            <label class="f-14 text-dark-grey mb-1">
                                @lang('app.date') <span class="text-danger">*</span>
                            </label>
                            <input type="text"
                                   class="form-control height-35 f-14 date-picker"
                                   name="date[]"
                                   id="dateField1"
                                   placeholder="@lang('app.date')"
                                   value=""
                                   autocomplete="off">
                        </div>
                    </div>

                    <!-- Overtime Type Field -->
                    <div class="col-md-3">
                        <div class="form-group">
                            <label class="f-14 text-dark-grey mb-1">
                                @lang('payroll::modules.payroll.overtimeType') <span class="text-danger">*</span>
                            </label>
                            <select name="type[]"
                                    id="type"
                                    data-live-search="true"
                                    class="form-control select-picker"
                                    data-size="8">

                            </select>
                        </div>
                    </div>

                    <!-- Duration Fields -->
                    <div class="col-md-3">
                        <div class="form-group">
                            <label class="f-14 text-dark-grey mb-1">
                                @lang('app.duration') <span class="text-danger">*</span>
                            </label>
                            <div class="d-flex align-items-center">
                                <input type="number"
                                       min="0"
                                       class="form-control height-35 f-14 mr-2"
                                       name="overtime_hours[]"
                                       placeholder="00">
                                <span class="mr-2">hrs</span>
                                <input type="number"
                                       min="0"
                                       max="59"
                                       class="form-control height-35 f-14"
                                       name="minutes[]"
                                       placeholder="00">
                                <span class="ml-2">mins</span>
                            </div>
                        </div>
                    </div>

                    <!-- Reason Field -->
                    <div class="col-md-3">
                        <div class="form-group">
                            <label class="f-14 text-dark-grey mb-1">
                                @lang('app.reason')
                            </label>
                            <input type="text"
                                   class="form-control height-35 f-14"
                                   name="overtime_reasons[]"
                                   placeholder="@lang('app.reason')"
                                   value="">
                        </div>
                    </div>
                </div>



                <div id="insertBefore"></div>

                <!--  ADD ITEM START-->

            <input type="hidden" name="start_date" id="start_date" value="">
            <input type="hidden" name="end_date" id="end_date" value="">

            <div class="col-md-12 pl-0">
                <a class="f-15 f-w-500" href="javascript:;" id="add-item"><i
                        class="mr-1 icons icon-plus font-weight-bold"></i> @lang('app.add')</a>
            </div>

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
      var applyDate = new Date();
      var lastDate = new Date();
      var typeOptionData = '';

    $(document).ready(function () {

        $(".select-picker").selectpicker();

        var $insertBefore = $('#insertBefore');
        var i = 1;
        var selectedDates = [];

        @if (!user()->hasRole('admin'))
            getPolicy({{ user()->id }})
        @endif
        $('#employee').change(function () {
            var id = $(this).val();
            getPolicy(id)
        });

        // Add More Inputs
        $('#add-item').click(function() {
            i += 1;

            var newDatePickerHtml = `
            <div id="addMoreBox${i}" class="clearfix row mb-3">
    <div class="col-lg-2 col-md-6 col-12">
        <div class="form-group">
            <input type="text"
                   class="form-control height-35 f-14"
                   placeholder="{{ __('app.date') }}"
                   value=""
                   name="date[]"
                   id="dateField${i}">
        </div>
    </div>

    <div class="col-lg-3 col-md-6 col-12">
        <div class="form-group">
            <select name="type[]"
                    id="dataType${i}"
                    class="form-control select-picker"
                    data-size="8">
                ${typeOptionData}
            </select>
        </div>
    </div>

    <div class="col-lg-3 col-md-6 col-12">
        <div class="form-group">
            <div class="d-flex align-items-center">
                <input type="number"
                       min="0"
                       id="overtime_hours${i}"
                       class="form-control height-35 f-14 mr-2"
                       name="overtime_hours[]"
                       value=""
                       placeholder="00">
                <span class="mt-2">hrs</span>
                <input type="number"
                       min="0"
                       name="minutes[]"
                       value=""
                       class="form-control height-35 f-14 ml-2"
                       placeholder="00">
                <span class="mt-2 ml-2"> mins</span>
            </div>
        </div>
    </div>

    <div class="col-lg-3 col-md-6 col-12">
        <div class="form-group">
            <input type="text"
                   class="form-control height-35 f-14"
                   placeholder="{{ __('app.reason') }}"
                   value=""
                   name="overtime_reasons[]"
                   id="overtime_reasons${i}">
        </div>
    </div>

    <div class="col-lg-1 col-md-6 col-12 d-flex align-items-center">
        <a href="javascript:;" class="remove-item" data-item-id="${i}">
            <i class="fa fa-times-circle f-20 text-danger"></i>
        </a>
    </div>
</div>`;

            $(newDatePickerHtml).insertBefore($insertBefore);

            // Recently Added date picker assign
            initializeDatePicker(`#dateField${i}`);
            $(".select-picker").selectpicker();
        });

        // Remove fields
        $('body').on('click', '.remove-item', function() {
            var index = $(this).data('item-id');
            var removedDate = $(`#dateField${index}`).val();
            $(`#addMoreBox${index}`).remove();
        });

    });

    // Function to initialize a date picker with disabled dates
    function initializeDatePicker(selector) {
            if ($(selector).length > 0) {
                datepicker(selector, {
                    position: 'bl',
                    minDate: applyDate,
                    maxDate: lastDate,
                    ...datepickerConfig
                });
            }
        }

    // save request
    $('#save-request').click(function (e) {
        e.preventDefault();

        $.easyAjax({
            url: "{{ route('overtime-requests.store') }}",
            container: '#overtimeHoursForm',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#save-request",
            data: $('#overtimeHoursForm').serialize(),
            success: function (response) {
                if (response.status == "success") {
                    $(MODAL_LG).modal('hide');
                }
                showTable();
            }
        })
    });

    // save request
    function getPolicy(id){
        if(id != '' && id != undefined)
        {
            var url = "{{ route('overtime-request-policy', ':id') }}";
            url = url.replace(':id', id);
            $.easyAjax({
                url: url,
                container: '#overtimeHoursForm',
                type: "GET",
                blockUI: true,
                disableButton: true,
                buttonSelector: "#save-request",
                data: $('#overtimeHoursForm').serialize(),
                success: function (response) {
                    applyDate = new Date(response.applyDate);
                    lastDate = new Date(response.currentMonthDate);
                    $('#start_date').val(moment(applyDate).format('YYYY-MM-DD'));
                    $('#end_date').val(moment(lastDate).format('YYYY-MM-DD'));
                    initializeDatePicker('#dateField1');
                    typeOptionData = response.typeOptions;
                    console.log(typeOptionData);
                    $('#type').html(typeOptionData);
                    $("#type").selectpicker('refresh');
                }
            });
        }

    }

</script>
