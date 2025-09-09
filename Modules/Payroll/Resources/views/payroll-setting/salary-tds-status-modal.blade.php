<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('app.edit') @lang('payroll::app.menu.salaryTds')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="addSalaryTest" method="POST" class="ajax-form">
            <div class="form-body">
                <div class="row">
                    <div class="col-lg-5">
                        <x-forms.number fieldId="tds_salary"
                                        :fieldLabel="__('payroll::modules.payroll.assignTdsSalary') . ' (' .$currency->currency_symbol. ' ' .$currency->currency_code.')'"
                                        fieldName="tds_salary" fieldRequired="true"
                                        :fieldValue="$payrollSetting->tds_salary">
                        </x-forms.number>
                    </div>
                    <div class="col-lg-5">
                        <x-forms.select fieldId="finance_month"
                                        :fieldLabel="__('payroll::modules.payroll.financeStartMonth') . ' (' .$currency->currency_symbol. ' ' .$currency->currency_code.')'"
                                        fieldName="finance_month" fieldRequired="true">
                            <x-forms.months :selectedMonth="$payrollSetting->finance_month" fieldRequired="true"/>

                        </x-forms.select>
                    </div>
                    <div class="col-lg-2">
                        <x-forms.toggle-switch class="mr-0 mr-lg-2 mr-md-2" :checked="$payrollSetting->tds_status"
                                               :fieldLabel="__('app.status')" fieldName="status"
                                               fieldId="status"/>
                    </div>
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="save-salary-tds" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script>
    $(".select-picker").selectpicker();
    // save channel
    $('#save-salary-tds').click(function () {
        $.easyAjax({
            url: "{{route('salary_tds.status')}}",
            container: '#addSalaryTest',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#save-salary-tds",
            data: $('#addSalaryTest').serialize(),
            success: function (response) {
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        })
    });
</script>
