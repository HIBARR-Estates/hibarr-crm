<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('app.status')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="change-status-form" method="POST" class="ajax-form">
            <div class="form-body">
                <div class="row">
                    <div class="col-lg-4">
                        <div class="form-group mb-3">
                            <div class="d-flex">
                                <x-forms.radio fieldId="status_generated"
                                               :fieldLabel="__('payroll::modules.payroll.generated')"
                                               fieldName="status" fieldValue="generated" checked="true">
                                </x-forms.radio>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-8">
                        <p class="mt-2 mb-0">
                            @lang('payroll::modules.payroll.generatedInfo')
                        </p>
                    </div>
                </div>
                <div class="row">
                    <div class="col-lg-4">
                        <div class="form-group mb-3">
                            <div class="d-flex">
                                <x-forms.radio fieldId="status_review"
                                               :fieldLabel="__('payroll::modules.payroll.review')"
                                               fieldName="status" fieldValue="review">
                                </x-forms.radio>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-8">
                        <p class="mt-2 mb-0">
                            @lang('payroll::modules.payroll.reviewInfo')
                        </p>
                    </div>
                </div>
                <div class="row">
                    <div class="col-lg-4">
                        <div class="form-group mb-3">
                            <div class="d-flex">
                                <x-forms.radio fieldId="status_locked"
                                               :fieldLabel="__('payroll::modules.payroll.locked')"
                                               fieldName="status" fieldValue="locked">
                                </x-forms.radio>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-8">
                        <p class="mt-2 mb-0">
                            @lang('payroll::modules.payroll.lockedInfo')
                        </p>
                    </div>
                </div>
                <div class="row">
                    <div class="col-lg-4">
                        <div class="form-group mb-3">
                            <div class="d-flex">
                                <x-forms.radio fieldId="status_paid" :fieldLabel="__('payroll::modules.payroll.paid')"
                                               fieldName="status" fieldValue="paid">
                                </x-forms.radio>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-8">
                        <p class="mt-2 mb-0">
                            @lang('payroll::modules.payroll.paidInfo')
                        </p>
                    </div>
                </div>
                <div class="row d-none" id="payment-fields">
                    <div class="col-lg-4">
                        <x-forms.datepicker fieldId="paid_on" fieldRequired="true"
                                            :fieldLabel="__('modules.payments.paidOn')" fieldName="paid_on"
                                            :fieldValue="now()->timezone($company->timezone)->format($company->date_format)"
                                            :fieldPlaceholder="__('placeholders.date')"/>
                    </div>
                    <div class="col-lg-4">
                        <x-forms.select fieldId="salary_payment_method_id"
                                        :fieldLabel="__('payroll::modules.payroll.salaryPaymentMethod')"
                                        fieldName="salary_payment_method_id" fieldRequired="true">
                            @foreach($paymentMethods as $item)
                                <option value="{{ $item->id }}">{{ $item->payment_method }}</option>
                            @endforeach
                        </x-forms.select>
                    </div>
                    <div class="col-lg-4">
                        <x-forms.select fieldId="add_expenses"
                                        :fieldLabel="__('payroll::modules.payroll.addAmountExpenses')"
                                        fieldName="add_expenses" fieldRequired="true">
                            <option value="no">@lang('app.no')</option>
                            <option value="yes">@lang('app.yes')</option>
                        </x-forms.select>
                    </div>
                </div>
                <div class="row" id="expenseCategory">
                    <div class="col-lg-4">
                        <x-forms.select fieldId="category_id" :fieldLabel="__('payroll::modules.payroll.category')"
                                        fieldName="category_id">
                            <option value="">--</option>
                            @foreach($expenseCategory as $item)
                                <option value="{{ $item->id }}">{{ $item->category_name }}</option>
                            @endforeach
                        </x-forms.select>
                    </div>
                    <div class="col-lg-6">
                        <x-forms.text :fieldLabel="__('payroll::modules.payroll.expenseTitle')"
                                      fieldName="expense_title"
                                      fieldId="expense_title"
                                      :fieldPlaceholder="__('payroll::modules.payroll.expenseTitle')"/>
                    </div>
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="update-status" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script>
    $(document).ready(function () {
        let oldValue = '';
        $(".select-picker").selectpicker();

        datepicker('#paid_on', {
            position: 'bl',
            ...datepickerConfig
        });

        $("input[name='status']").change(function () {
            let value = $(this).val();
            if (value == "paid" || oldValue == "paid") {
                $('#payment-fields').toggleClass('d-none');
                oldValue = value;
            }
        })
    });
    $('#expenseCategory').hide();
    $('#add_expenses').change(function () {
        let add_expenses = $(this).val();
        if (add_expenses == 'yes') {
            $('#expenseCategory').show();

        } else {
            $('#expenseCategory').hide();

        }
        let month = $('#month :selected').text();
        let year = $('#year :selected').text();
        var token = "{{ csrf_token() }}";

        var url = "{{ route('payroll.get_expense_title') }}";
        url = url.replace(':id',);
        $.easyAjax({
            url: url,
            type: "POST",
            disableButton: true,
            data: {
                '_token': token, 'status': add_expenses, 'month': month, 'year': year
            },
            success: function (response) {
                console.log(response);
                if (response.status == 'success') {
                    $('#expense_title').val(response.expenseTitle);
                }
            }
        })


    })

</script>
