<div class="row">
    <div class="col-sm-12">
        <x-form id="save-salary-form">
            <x-cards.data :title="__('payroll::modules.payroll.addSalary')" class="add-client">

                <div class="row">
                    <div class="col-md-12">
                        <div class="row">
                            <div class="col-md-12 my-2">
                                <x-employee :user="$employee" />
                            </div>
                            <div class="col-md-2">
                                <x-forms.label class="my-3" fieldId=""
                                               :fieldLabel="__('payroll::modules.payroll.salary')" fieldRequired="true">
                                </x-forms.label>


                                <p class="f-11 text-grey">@lang('payroll::modules.payroll.annualCtcInfo')</p>

                                <input type="hidden" name="user_id" id="user_id" value="{{ $user_id }}">
                                <input type="hidden" name="type" id="type" value="initial">
                            </div>
                            <div class="col-md-4">
                                <x-forms.input-group class="mt-2">

                                    <x-slot name="prepend" id="currency">
                                        <span
                                            class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                    </x-slot>

                                    <input type="number" class="form-control height-35 f-14" name="annual_salary"
                                           onkeyup="changeClc()"
                                           id="annual_salary" value="">
                                </x-forms.input-group>

                            </div>
                        </div>
                    </div>


                    <div class="col-md-12">
                        <div class="row border-bottom-grey mt-4">
                            <div class="col-md-3">

                                <h5 class="heading-h5  mb-0 py-4">
                                    @lang('payroll::modules.payroll.salaryComponent')</h5>
                            </div>
                            <div class="col-md-3">
                                <h5 class="heading-h5  mb-0 py-4">
                                    @lang('payroll::modules.payroll.calculationType')</h5>
                            </div>
                            <div class="col-md-3">
                                <h5 class="heading-h5  mb-0 py-4">
                                    @lang('payroll::modules.payroll.monthlyAmount')</h5>
                            </div>
                            <div class="col-md-3">
                                <h5 class="heading-h5  mb-0 py-4">
                                    @lang('payroll::modules.payroll.annualAmount')</h5>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-12" id="components">
                        <div class="row">
                            <div class="col-md-12">
                                <h3 class="heading-h3  mb-0 py-4">
                                    @lang('payroll::modules.payroll.earning')</h3>
                            </div>
                            <div class="col-md-12">
                                <div class="row mb-2">
                                    <div class="col-md-3">
                                        <x-forms.label fieldId=""
                                                    :fieldLabel="__('payroll::modules.payroll.basicPay')">
                                        </x-forms.label>
                                    </div>
                                    <div class="col-md-3">

                                        <x-forms.input-group>
                                            <input type="number" value="50" onmouseout="changeClc()" name="basic_salary" id="basic_value"
                                                class="form-control height-35 f-15" style="width:30%">

                                        <select name="basic_value" id="basic-type" onchange="selectType(this.value)" class="form-control select-picker" data-size="8">
                                            <option value="ctc_percent">@lang('payroll::modules.payroll.percentOfCTC')</option>
                                            <option value="fixed">@lang('payroll::modules.payroll.fixed')</option>
                                        </select>
                                        </x-forms.input-group>

                                    </div>
                                    <div class="col-md-3">
                                        <x-forms.input-group>

                                            <x-slot name="prepend" id="currency">
                                                <span
                                                    class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                            </x-slot>

                                            <input type="text" class="form-control height-35 f-14"
                                                id=""
                                                value="{{ $payrollController->currencyFormatterCustom(0) }}"
                                                readonly>

                                        </x-forms.input-group>
                                    </div>
                                    <div class="col-md-3">
                                        <x-forms.input-group>
                                            <x-slot name="prepend" id="currency">
                                                <span
                                                    class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                            </x-slot>

                                            <input type="text" class="form-control height-35 f-14"
                                                id=""
                                                value="{{ $payrollController->currencyFormatterCustom(0) }}"
                                                readonly>
                                        </x-forms.input-group>

                                    </div>
                                </div>
                            </div>

                            @if (!is_null($salaryGroup))
                                @foreach ($salaryGroup->salary_group->components as $component)
                                    <div class="col-md-12 mt-1">
                                        <div class="row">
                                            @if ($component->component->component_type == 'earning')
                                                <div class="col-md-3">
                                                    <x-forms.label fieldId=""
                                                    :fieldLabel="$component->component->component_name" />
                                                </div>
                                                <div class="col-md-3">
                                                    @if ($component->component->value_type == 'basic_percent')
                                                    <x-forms.label fieldId=""
                                                        :fieldLabel="($component->component->component_value.' '.__('payroll::modules.payroll.percentOfBasic'))" />
                                                    @else
                                                    <x-forms.label fieldId=""
                                                        :fieldLabel="$component->component->value_type ?? '--'" />
                                                    @endif
                                                </div>
                                                <div class="col-md-3">
                                                    @if ($component->component->value_type == 'variable')
                                                        <x-forms.input-group>
                                                            <x-slot name="prepend" id="currency">
                                                            <span
                                                                class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                                            </x-slot>
                                                            <input type="text" class="form-control height-35 f-14"
                                                                 id=""
                                                                value="{{ $payrollController->currencyFormatterCustom(0) }}">
                                                        </x-forms.input-group>

                                                    @else
                                                        <x-forms.input-group>
                                                            <x-slot name="prepend" id="currency">
                                                            <span
                                                                class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                                            </x-slot>
                                                            <input type="text" class="form-control height-35 f-14"
                                                                 id=""
                                                                value="{{ $payrollController->currencyFormatterCustom(0) }}"
                                                                readonly>
                                                        </x-forms.input-group>

                                                    @endif
                                                </div>

                                                <div class="col-md-3">
                                                    <x-forms.input-group>
                                                        <x-slot name="prepend" id="currency">
                                                            <span
                                                                class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                                        </x-slot>
                                                        <input type="text" class="form-control height-35 f-14"
                                                             id=""
                                                            value="{{ $payrollController->currencyFormatterCustom(0) }}"
                                                            readonly>
                                                    </x-forms.input-group>


                                                </div>
                                            @endif
                                        </div>
                                    </div>
                                @endforeach
                            @endif
                            <div class="col-md-12">
                                <div class="row my-3">
                                    <div class="col-md-3">
                                        <x-forms.label fieldId="" :popover="__('payroll::messages.fixedAllowanceMessage')"
                                                    :fieldLabel="__('payroll::modules.payroll.fixedAllowance')"
                                                    fieldRequired="">
                                        </x-forms.label>
                                        <p class="f-11 text-grey">@lang('payroll::modules.payroll.extraPay')</p>
                                    </div>
                                    <div class="col-md-3">

                                        <x-forms.label fieldId="" :fieldLabel="__('payroll::modules.payroll.fixedAllowance')" />

                                    </div>
                                    <div class="col-md-3">
                                        <x-forms.label fieldId="" :fieldLabel="currency_format(0, ($currency->currency ? $currency->currency->id : company()->currency->id ))" />
                                    </div>

                                    <div class="col-md-3">

                                        <x-forms.label fieldId="" :fieldLabel="currency_format(0, ($currency->currency ? $currency->currency->id : company()->currency->id ))" />
                                    </div>
                                </div>
                            </div>
                            {{-- </div> --}}

                            <div class="col-md-12 salary-total mt-2 rounded bg-light">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h3 class="heading-h3 mb-0 py-4">
                                            @lang('payroll::modules.payroll.costToCompany')</h3>
                                    </div>
                                    <div class="col-md-3">
                                        <h3 class="heading-h3 mb-0 py-4">
                                            {{ currency_format(0, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h3>
                                    </div>
                                    <div class="col-md-3">
                                        <h3 class="heading-h3 mb-0 py-4">
                                            {{ currency_format(0, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h3>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>

                <div class='w-100 d-block d-lg-flex d-md-flex justify-content-start pt-3'>
                    <x-forms.button-primary id="save-initial-salary" class="mr-3" icon="check">@lang('app.save')
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="route('employee-salary.index')" class="border-0">@lang('app.cancel')
                    </x-forms.button-cancel>
                </div>
            </x-cards.data>
        </x-form>

    </div>
</div>
<script>

    $("#annual_salary").on("keyup change", function (e) {
        var annualSalary = $(this).val();
        var monthlySalary = annualSalary / 12;
        let netMonthlySalary = number_format(monthlySalary.toFixed(2));
        $('#monthly_salary').html(netMonthlySalary);
    });

    function changeClc() {
        var basicSalary = $('#basic_value').val();
        if($('#basic-type').val() == 'ctc_percent' && basicSalary > 100){
            $('#basic_value').val(100);
        }
        if(basicSalary > 0){
            getBasicCalculations();
        }
    }

    function selectType(vals) {
        getBasicCalculations();
    }

    function getBasicCalculations() {

        var basicType = $('#basic-type').val();
        var basicValue = $('#basic_value').val();
        var annualSalary = $('#annual_salary').val();
        var userId = $('#user_id').val();

        const url = "{{ route('employee-salary.get-salary') }}";
        $.easyAjax({
            url: url,
            type: "GET",
            disableButton: true,
            blockUI: true,
            data: {
                basicType: basicType,
                basicValue: basicValue,
                annualSalary: annualSalary,
                userId: userId
            },
            success: function (response) {
                $('#components').html(response.component)
            }
        })
    }

    $('body').on('click', '#save-initial-salary', function () {

        $.easyAjax({
            url: "{{ route('employee-salary.store') }}",
            container: '#save-salary-form',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#save-initial-salary",
            data: $('#save-salary-form').serialize(),
            success: function (response) {
                if (response.status == 'success') {
                    if ($(MODAL_XL).hasClass('show')) {
                        $(MODAL_XL).modal('hide');
                        window.location.reload();
                    } else {
                        window.location.href = response.redirectUrl;
                    }
                }
            }
        });

    });

    function number_format(number) {
        let decimals = '{{ currency_format_setting()->no_of_decimal }}';
        let thousands_sep = '{{ currency_format_setting()->thousand_separator }}';
        let currency_position = '{{ currency_format_setting()->currency_position }}';
        let dec_point = '{{ currency_format_setting()->decimal_separator }}';
        // Strip all characters but numerical ones.
        number = (number + '').replace(/[^0-9+\-Ee.]/g, '');

        var currency_symbol = '{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}';

        var n = !isFinite(+number) ? 0 : +number,
            prec = !isFinite(+decimals) ? 0 : Math.abs(decimals),
            sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
            dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
            s = '',
            toFixedFix = function (n, prec) {
                var k = Math.pow(10, prec);
                return '' + Math.round(n * k) / k;
            };
        // Fix for IE parseFloat(0.55).toFixed(0) = 0;
        s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
        if (s[0].length > 3) {
            s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
        }
        if ((s[1] || '').length < prec) {
            s[1] = s[1] || '';
            s[1] += new Array(prec - s[1].length + 1).join('0');
        }

        // number = dec_point == '' ? s[0] : s.join(dec);

        number = s.join(dec);

        switch (currency_position) {
            case 'left':
                number = currency_symbol + number;
                break;
            case 'right':
                number = number + currency_symbol;
                break;
            case 'left_with_space':
                number = currency_symbol + ' ' + number;
                break;
            case 'right_with_space':
                number = number + ' ' + currency_symbol;
                break;
            default:
                number = currency_symbol + number;
                break;
        }
        return number;
    }

    $('.variable').on('keydown', e => {
        lastValue = $(e.target).val();
        lastValue = lastValue.replace(/[,]/g, '');
    });

</script>
