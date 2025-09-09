<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('app.edit') @lang('payroll::app.menu.salaryTds')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="addSalaryTest" method="PUT" class="ajax-form">
            <div class="form-body">
                <div class="row">
                    <div class="col-lg-6">
                        <x-forms.number fieldId="salary_from" :fieldLabel="__('payroll::modules.payroll.salaryFrom')"
                                        fieldName="salary_from" fieldRequired="true"
                                        :fieldValue="$salaryTds->salary_from">
                        </x-forms.number>
                    </div>
                    <div class="col-lg-6">
                        <x-forms.number fieldId="salary_to" :fieldLabel="__('payroll::modules.payroll.salaryTo')"
                                        fieldName="salary_to" fieldRequired="true" :fieldValue="$salaryTds->salary_to">
                        </x-forms.number>
                    </div>
                </div>
                <div class="row">
                    <div class="col-lg-6">
                        <x-forms.number fieldId="salary_percent"
                                        :fieldLabel="__('payroll::modules.payroll.salaryPercent')"
                                        fieldName="salary_percent" fieldRequired="true"
                                        :fieldValue="$salaryTds->salary_percent">
                        </x-forms.number>
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
            url: "{{route('salary-tds.update', $salaryTds->id)}}",
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
