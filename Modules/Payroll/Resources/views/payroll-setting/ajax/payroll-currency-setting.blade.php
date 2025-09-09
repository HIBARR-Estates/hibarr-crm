<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    <x-form id="currency-setting" method="POST" class="ajax-form">
        <div class="form-body">
    <div class="col-lg-4 mb-4">
        <x-forms.select fieldId="currency" :fieldLabel="__('payroll::modules.payroll.choosePayrollCurrency')"
        fieldName="currency" fieldRequired="true" search="true">
        <option value = ''>--</option>
        @foreach($currencies as $currency)
            <option value="{{ $currency->id}}" @if($currency->id == $payrollCurrency) selected @endif>{{ $currency->currency_symbol . ' (' . $currency->currency_code . ')' }}</option>
            @endforeach
        </x-forms.select>
    </div>
        </div>
    </x-form>
    <div class="w-100 border-top-grey set-btns">
        <x-setting-form-actions>
            <x-forms.button-primary id="save-currency" class="mr-3" icon="check">@lang('app.save')
            </x-forms.button-primary>
        </x-setting-form-actions>
    </div>

    <script>

        $('#save-currency').click(function () {

            var currency = $('#currency').val();
            var token = "{{ csrf_token() }}";
            $.easyAjax({
                url: "{{ route('payroll-currency-settings.index') }}",
                container: '#currency-setting',
                type: "POST",
                blockUI: true,
                disableButton: true,
                buttonSelector: "#save-currency",
                data: {
                    currency: currency,
                    _token: token,
                },
                success: function (response) {

                }
            })
        });
    </script>
