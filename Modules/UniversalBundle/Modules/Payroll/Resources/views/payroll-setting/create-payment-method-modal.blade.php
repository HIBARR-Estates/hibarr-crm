<div class="modal-header">
    <h5 class="modal-title"
        id="modelHeading">@lang('app.add') @lang('payroll::modules.payroll.salaryPaymentMethod')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="addPaymentMethod" method="POST" class="ajax-form">

            <div class="form-body">
                <div class="row">
                    <div class="col-lg-12">
                        <x-forms.text fieldId="payment_method"
                                      :fieldLabel="__('payroll::modules.payroll.salaryPaymentMethod')"
                                      fieldName="payment_method" fieldRequired="true">
                        </x-forms.text>
                    </div>
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="save-payment-method" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script>
    // save source
    $('#save-payment-method').click(function () {
        $.easyAjax({
            url: "{{ route('payment-methods.store') }}",
            container: '#addPaymentMethod',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#save-payment-method",
            data: $('#addPaymentMethod').serialize(),
            success: function (response) {
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        })
    });
</script>
