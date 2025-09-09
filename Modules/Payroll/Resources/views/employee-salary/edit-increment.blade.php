<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('payroll::modules.payroll.updateSalary')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
   
    <x-form id="updateSalary" method="POST">
        <input type="hidden" name="user_id" value="{{ $employee->id }}"/>
        <div class="form-body">
            <div class="row">
                <div class="col-lg-4">
                    <x-forms.select fieldId="type" :fieldLabel="__('payroll::modules.payroll.valueType')"
                                    fieldName="type" fieldRequired="true">
                        <option @if ($employeeSalary->type == 'increment') selected @endif value="increment">@lang('payroll::modules.payroll.increment')</option>
                        <option @if ($employeeSalary->type == 'decrement') selected @endif value="decrement">@lang('payroll::modules.payroll.decrement')</option>
                    </x-forms.select>
                </div>
                <div class="col-lg-4">
                    <x-forms.number fieldId="amount" class="annualIncrementAmount" :fieldLabel="__('payroll::modules.payroll.annualIncrementAmount')" :fieldValue="$employeeSalary->annual_salary"
                                    fieldName="annual_salary"
                                    fieldRequired="true">
                    </x-forms.number>
                </div>

                <div class="col-lg-4">
                    <x-forms.datepicker fieldId="date" fieldRequired="true"
                        :fieldLabel="__('payroll::modules.payroll.incrementDate')" fieldName="date"
                        :fieldValue="$employeeSalary->date->timezone(company()->timezone)->format(company()->date_format)"
                        :fieldPlaceholder="__('placeholders.date')" />
                </div>
                
            </div>
        </div>
    </x-form>
   
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="update-salary" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script>
    $(document).ready(function () {
        $(".select-picker").selectpicker();

        datepicker('#date', {
            position: 'bl',
            ...datepickerConfig
        });
    });
    /* update salary */
    $('#update-salary').click(function () {
        const salaryId = {{$employeeSalary->id}};
        const url = "{{ route('employee-salary.increment_update') }}?salaryId=" + salaryId;
        $.easyAjax({
            url: url,
            container: '#updateSalary',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#update-salary",
            data: $('#updateSalary').serialize(),
            success: function (response) {
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        })
    });

</script>
