<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('app.edit') @lang('payroll::modules.payroll.salaryComponents')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="editSalaryComponents" method="PUT" class="ajax-form">
            <div class="form-body">

                <div class="row">
                    <div class="col-lg-6">
                        <x-forms.text fieldId="component_name"
                                      :fieldLabel="__('payroll::modules.payroll.salaryComponents')"
                                      fieldName="component_name" fieldRequired="true"
                                      :fieldValue="$salaryComponent->component_name">
                        </x-forms.text>
                    </div>
                    <div class="col-lg-6">
                        <x-forms.select fieldId="component_type"
                                        :fieldLabel="__('payroll::modules.payroll.componentType')"
                                        fieldName="component_type" fieldRequired="true">
                            <option value="earning"
                                    @if($salaryComponent->component_type == 'earning') selected @endif>@lang('payroll::modules.payroll.earning')</option>
                            <option value="deduction"
                                    @if($salaryComponent->component_type == 'deduction') selected @endif>@lang('payroll::modules.payroll.deduction')</option>
                        </x-forms.select>
                    </div>
                </div>
                <div class="row">

                    <div class="col-lg-6">
                        <x-forms.select fieldId="value_type" :fieldLabel="__('payroll::modules.payroll.valueType')"
                                        fieldName="value_type" fieldRequired="true">

                            <option value="fixed"
                                    @if($salaryComponent->value_type == 'fixed') selected @endif>@lang('payroll::modules.payroll.fixed')</option>
                            <option value="percent"
                                    @if($salaryComponent->value_type == 'percent') selected @endif>@lang('payroll::modules.payroll.ctcPercent')</option>
                            <option value="basic_percent"
                                    @if($salaryComponent->value_type == 'basic_percent') selected @endif>@lang('payroll::modules.payroll.basicPercent')</option>
                            <option value="variable"
                                    @if($salaryComponent->value_type == 'variable') selected @endif>@lang('payroll::modules.payroll.variable')</option>
                        </x-forms.select>
                    </div>
                    <div class="col-lg-6">
                        <x-forms.number fieldId="component_value" :fieldLabel="__('payroll::modules.payroll.componentValueMonthly')"
                         fieldName="component_value" fieldRequired="true" :fieldValue="$salaryComponent->component_value">
                        </x-forms.number>
                    </div>
                    <div class="col-lg-6 percentageBox">
                        <x-forms.number fieldId="weekly_value" :fieldLabel="__('payroll::modules.payroll.componentValueWeekly')" fieldValue="{{$salaryComponent->weekly_value}}"
                                      fieldName="weekly_value" fieldRequired="false">
                        </x-forms.number>
                    </div>
                    <div class="col-lg-6 percentageBox">
                        <x-forms.number fieldId="biweekly_value" :fieldLabel="__('payroll::modules.payroll.componentValueBi-weekly')" fieldValue="{{$salaryComponent->biweekly_value}}"
                                      fieldName="biweekly_value" fieldRequired="false">
                        </x-forms.number>
                    </div>
                    <div class="col-lg-6 percentageBox">
                        <x-forms.number fieldId="semimonthly_value" :fieldLabel="__('payroll::modules.payroll.componentValueSemi-monthly')" fieldValue="{{$salaryComponent->semimonthly_value}}"
                                      fieldName="semimonthly_value" fieldRequired="false">
                        </x-forms.number>
                    </div>

                </div>

            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="save-salary-component" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script>
      $('#component_value').on('keyup', function(e) {
        var value = $(this).val();
        var perday = value / 30;
        var weekly = perday * 7;
        var biWeekly = weekly *2;
        var semiMonthly = perday * 15;
       $('#weekly_value').val(weekly.toFixed(2));
       $('#biweekly_value').val(biWeekly.toFixed(2));
       $('#semimonthly_value').val(semiMonthly.toFixed(2));

    });
    $('#weekly_value').on('keyup', function(e) {
        var value = $(this).val();
        var perday = value / 7;
        var monthly = perday * 30;
        var biWeekly = value * 2;
        var semiMonthly = monthly / 2;
       $('#component_value').val(monthly.toFixed(2));
       $('#biweekly_value').val(biWeekly.toFixed(2));
       $('#semimonthly_value').val(semiMonthly.toFixed(2));

    });
    $('#biweekly_value').on('keyup', function(e) {
        var value = $(this).val();
        var perdays = value / 14;
        var weekly = perdays * 7;
        var monthly = perdays * 30;
        var semiMonthly = monthly / 2;
       $('#component_value').val(monthly.toFixed(2));
       $('#weekly_value').val(weekly.toFixed(2));
       $('#semimonthly_value').val(semiMonthly.toFixed(2));

    });
    $('#semimonthly_value').on('keyup', function(e) {
        var value = $(this).val();
        var perday = value / 15;
        var monthly = perday * 30;
        var Weekly = perday * 7;
        var biWeekly = Weekly * 2;
       $('#component_value').val(monthly.toFixed(2));
       $('#biweekly_value').val(biWeekly.toFixed(2));
       $('#weekly_value').val(Weekly.toFixed(2));

    });

    checkValueType($('#value_type').val());

    $('#value_type').on('change', function(e) {
        var value = $(this).val();
        checkValueType(value);
    });

    function checkValueType(value){
        if(value == 'percent' || value == 'basic_percent')
        {
            $('.percentageBox').hide();
        }
        else{
            $('.percentageBox').show();
        }
    }


    $(".select-picker").selectpicker();
    // save channel
    $('#save-salary-component').click(function () {
        $.easyAjax({
            url: "{{route('salary-components.update', $salaryComponent->id)}}",
            container: '#editSalaryComponents',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#save-salary-component",
            data: $('#editSalaryComponents').serialize(),
            success: function (response) {
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        })
    });
</script>
