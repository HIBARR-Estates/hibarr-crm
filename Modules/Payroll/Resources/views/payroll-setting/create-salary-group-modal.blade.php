<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('app.add') @lang('payroll::modules.payroll.salaryGroup')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="addSalaryGroup" method="POST" class="ajax-form">
            <div class="form-body">
                <div class="row">
                    <div class="col-lg-6">
                        <x-forms.text fieldId="group_name" :fieldLabel="__('app.name')"
                                      fieldName="group_name" fieldRequired="true">
                        </x-forms.text>
                    </div>
                    <div class="col-lg-6">
                        <x-forms.select fieldId="salary_components"
                                        :fieldLabel="__('payroll::modules.payroll.assignComponents')"
                                        fieldName="salary_components[]" search="true" fieldRequired="true"
                                        multiple="true">
                            @foreach($salaryComponents as $salaryComponent)
                                <option
                                    value="{{ $salaryComponent->id }}">{{ $salaryComponent->component_name }}</option>
                            @endforeach
                        </x-forms.select>
                    </div>
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="save-salary-group" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script>

    $(".select-picker").selectpicker();
    // save source
    $('#save-salary-group').click(function () {
        $.easyAjax({
            url: "{{ route('salary-groups.store') }}",
            container: '#addSalaryGroup',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#save-salary-group",
            data: $('#addSalaryGroup').serialize(),
            success: function (response) {
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        })
    });
</script>
