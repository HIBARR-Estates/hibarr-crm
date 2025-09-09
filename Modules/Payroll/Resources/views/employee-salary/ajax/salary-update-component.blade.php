<div class="row">
    <div class="col-md-12">
        <h3 class="heading-h3  mb-0 py-4">
            @lang('payroll::modules.payroll.earning')</h3>
    </div>
    <div class="col-md-12">
        <div class="row mb-2">
            <div class="col-md-3">
                <x-forms.label fieldId="" :fieldLabel="__('payroll::modules.payroll.basicSalary')" />
            </div>
            <div class="col-md-3">
                <x-forms.input-group>
                    <input type="number" value="{{ $basicValue }}" onmouseout="changeClc()" name="basic_salary" id="basic_value"
                        class="form-control height-35 f-15 tttt"  style="width:30%" value="50">

                <select name="basic_value" id="basic-type"  onchange="selectType(this.value)" class="form-control select-picker" data-size="8">
                    <option @if($basicType == 'fixed') selected @endif value="fixed">@lang('payroll::modules.payroll.fixed')</option>
                    <option @if($basicType == 'ctc_percent') selected @endif value="ctc_percent">@lang('payroll::modules.payroll.percentOfCTC')</option>
                </select>
                </x-forms.input-group>

            </div>
            <div class="col-md-3">
                <x-forms.input-group>
                    <x-slot name="prepend" id="currency">
                        <span
                            class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                    </x-slot>
                    <input type="text" class="form-control height-35 f-14" name="basic_type" id="basic_type"
                        value="{{ $payrollController->currencyFormatterCustom($basicSalary) }}" readonly>
                </x-forms.input-group>
            </div>

            <div class="col-md-3">
                <x-forms.input-group>
                    <x-slot name="prepend" id="currency">
                        <span
                            class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                    </x-slot>
                    <input type="text" class="form-control height-35 f-14"
                        value="{{ $payrollController->currencyFormatterCustom($basicSalary * 12) }}" readonly>

                </x-forms.input-group>


            </div>
        </div>
    </div>

    @if (!is_null($salaryGroup))

        @foreach ($salaryGroup->salary_group->components as $key => $value)
            @php
                $compValue = $employeeVariableSalaries->where('variable_component_id', $value->component->id)->first() ?? null;

                if($compValue){
                    $componentValue = $compValue->variable_value;
                }
                else{
                    $componentValue = $value->component->component_value;
                }
            @endphp
            <div class="col-md-12 mt-1">
                <div class="row">
                    @if ($value->component->component_type == 'earning')
                        <div class="col-md-3">
                            <x-forms.label fieldId="" :fieldLabel="($value->component->component_name)" />
                        </div>
                        <div class="col-md-3">
                            @if ($value->component->value_type == 'basic_percent')
                                <x-forms.label fieldId="" :fieldLabel="($value->component->component_value.' '.__('payroll::modules.payroll.percentOfBasic'))" />
                            @else
                                <x-forms.label fieldId="" :fieldLabel="($value->component->value_type) ?? '--'" />
                            @endif
                        </div>
                        <div class="col-md-3">
                            @if ($value->component->value_type == 'fixed')
                                <x-forms.input-group>
                                    <x-slot name="prepend" id="currency">
                                        <span
                                            class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                    </x-slot>
                                    <input type="text" class="form-control height-35 f-14"

                                        value="{{ $payrollController->currencyFormatterCustom($value->component->component_value) }}"
                                        readonly>
                                </x-forms.input-group>

                            @elseif($value->component->value_type == 'percent')
                                <x-forms.input-group>
                                    <x-slot name="prepend" id="currency">
                                        <span
                                            class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                    </x-slot>
                                    <input type="text" class="form-control height-35 f-14"

                                        value="{{ $payrollController->currencyFormatterCustom(($annualSalary / 12 / 100) * $value->component->component_value) }}"
                                        readonly>

                                </x-forms.input-group>
                            @elseif($value->component->value_type == 'basic_percent')
                                <x-forms.input-group>
                                    <x-slot name="prepend" id="currency">
                                        <span
                                            class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                    </x-slot>
                                    <input type="text" class="form-control height-35 f-14"

                                        value="{{ $payrollController->currencyFormatterCustom(($basicSalary / 100) * $value->component->component_value) }}"
                                        readonly>

                                </x-forms.input-group>
                            @else
                                <div class="input-group">

                                    <span
                                        class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>

                                    <input type="text" class="form-control height-35 f-14 variable"
                                        name="earning_variable[{{ $value->component->id }}]"
                                        data-type-id="{{ $value->component->id }}"
                                        id="variable-{{ $value->component->id }}"
                                        value="{{ $componentValue }}">
                                </div>

                            @endif
                        </div>

                        <div class="col-md-3">
                            @if ($value->component->value_type == 'fixed')
                                <x-forms.input-group>
                                    <x-slot name="prepend" id="currency">
                                        <span
                                            class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol )}}</span>
                                    </x-slot>
                                    <input type="text" class="form-control height-35 f-14"

                                        value="{{ $payrollController->currencyFormatterCustom($value->component->component_value * 12) }}"
                                        readonly>
                                </x-forms.input-group>
                            @elseif($value->component->value_type == 'percent')
                                <x-forms.input-group>
                                    <x-slot name="prepend" id="currency">
                                        <span
                                            class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                    </x-slot>
                                    <input type="text" class="form-control height-35 f-14"

                                        value="{{ $payrollController->currencyFormatterCustom(($annualSalary / 12 / 100) * $value->component->component_value * 12) }}"
                                        readonly>
                                </x-forms.input-group>
                            @elseif($value->component->value_type == 'basic_percent')
                                <x-forms.input-group>
                                    <x-slot name="prepend" id="currency">
                                        <span
                                            class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                    </x-slot>
                                    <input type="text" class="form-control height-35 f-14"

                                        value="{{ $payrollController->currencyFormatterCustom(($basicSalary / 100) * $value->component->component_value * 12) }}"
                                        readonly>
                                </x-forms.input-group>
                            @else
                                <div class="input-group">

                                    <span
                                        class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>

                                    <input type="text" class="form-control height-35 f-14" name=""
                                        id="variableAnually{{ $value->component->id }}"
                                        value="{{ $componentValue * 12 }}"
                                        readonly>
                                </div>

                            @endif

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
                    :fieldLabel="__('payroll::modules.payroll.fixedAllowance')">
                </x-forms.label>
                <p class="f-11 text-grey">@lang('payroll::modules.payroll.extraPay')</p>
            </div>
            <div class="col-md-3">
                <x-forms.label fieldId="" :fieldLabel="__('payroll::modules.payroll.fixedAllowance')">
                </x-forms.label>
            </div>
            <div class="col-md-3">
                @if ($fixedAllowance >= 0)
                    <input type="hidden" min="0" step=".01" id="fixed_allowance_input"
                        name="fixed_allowance_input" value="{{ $fixedAllowance }}">
                        <x-forms.label fieldId="" class="monthlyFixedAllowance"
                        :fieldLabel="currency_format( $fixedAllowance, ($currency->currency ? $currency->currency->id : company()->currency->id ))" />
                @else
                <x-forms.label fieldId="" class="text-danger monthlyFixedAllowance"
                        :fieldLabel="currency_format($fixedAllowance, ($currency->currency ? $currency->currency->id : company()->currency->id ))" />
                @endif
            </div>

            <div class="col-md-3">
                @if ($fixedAllowance >= 0)
                    <x-forms.label fieldId="" class="yearFixedAllowance"
                            :fieldLabel="currency_format($fixedAllowance * 12, ($currency->currency ? $currency->currency->id : company()->currency->id ))" />
                    <input type="hidden" name="fixedAllowance" class="fixedAllowance" value="{{ $fixedAllowance }}"/>
                @else
                    <x-forms.label fieldId="" class="text-danger yearFixedAllowance"
                            :fieldLabel="currency_format($fixedAllowance * 12, ($currency->currency ? $currency->currency->id : company()->currency->id ))" />
                    <input type="hidden" name="fixedAllowance" value="{{ $fixedAllowance }}"/>
                @endif
            </div>

        </div>
    </div>
    <div class="col-md-12 salary-total mt-2 rounded bg-light">
        <div class="row">
            <div class="col-md-6">
                <h3 class="heading-h3 mb-0 py-4">
                    @lang('payroll::modules.payroll.costToCompany')</h3>
            </div>
            <div class="col-md-3">
                <h3 class="heading-h3 mb-0 py-4">
                    {{ currency_format($annualSalary / 12, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h4>
            </div>
            <div class="col-md-3">
                <h3 class="heading-h3 mb-0 py-4">
                    {{ currency_format($annualSalary, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h4>
            </div>
        </div>

    </div>
    <div class="col-md-12 mt-2 rounded">
        @if (!is_null($salaryGroup))
            @if (count($salaryGroup->salary_group->components) > 0)
                <div class="col-md-12">
                    <h3 class="heading-h3  mb-0">
                        @lang('payroll::modules.payroll.deduction')</h2>
                </div>
            @endif
            @foreach ($salaryGroup->salary_group->components as $key => $value)
                @php
                    $compValue = $employeeVariableSalaries->where('variable_component_id', $value->component->id)->first() ?? null;

                    if($compValue){
                        $componentValue = $compValue->variable_value;
                    }
                    else{
                        $componentValue = $value->component->component_value;
                    }
                @endphp
                <div class="col-md-12 mt-1">
                    <div class="row">
                        @if ($value->component->component_type == 'deduction')
                            <div class="col-md-3">
                                <x-forms.label fieldId="" :fieldLabel="($value->component->component_name)" />
                            </div>
                            <div class="col-md-3">
                                @if ($value->component->value_type == 'basic_percent')
                                    <x-forms.label fieldId="" :fieldLabel="($value->component->component_value.' '.__('payroll::modules.payroll.percentOfBasic'))" />
                                @else
                                    <x-forms.label fieldId="" :fieldLabel="($value->component->value_type) ?? '--'" />
                                @endif
                            </div>
                            <div class="col-md-3">
                                @if ($value->component->value_type == 'fixed')
                                    <x-forms.input-group>
                                        <x-slot name="prepend" id="currency">
                                            <span
                                                class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                        </x-slot>
                                        <input type="text" class="form-control height-35 f-14"

                                            value="{{ $payrollController->currencyFormatterCustom($value->component->component_value) }}"
                                            readonly>
                                    </x-forms.input-group>

                                @elseif($value->component->value_type == 'percent')
                                    <x-forms.input-group>
                                        <x-slot name="prepend" id="currency">
                                            <span
                                                class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                        </x-slot>
                                        <input type="text" class="form-control height-35 f-14"

                                            value="{{ $payrollController->currencyFormatterCustom(($employeeMonthlySalary->annual_salary / 12 / 100) * $value->component->component_value) }}"
                                            readonly>

                                    </x-forms.input-group>
                                @elseif($value->component->value_type == 'basic_percent')
                                    <x-forms.input-group>
                                        <x-slot name="prepend" id="currency">
                                            <span
                                                class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                        </x-slot>
                                        <input type="text" class="form-control height-35 f-14"

                                            value="{{ $payrollController->currencyFormatterCustom(($basicSalary / 100) * $value->component->component_value) }}"
                                            readonly>

                                    </x-forms.input-group>
                                @else
                                <div class="input-group">

                                    <span
                                        class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>

                                    <input type="text" class="form-control height-35 f-14 variable" data-type="deduction" data-type-id="{{ $value->component->id }}"
                                        name="deduction_variable[{{ $value->component->id }}]" id="deductionVariable{{ $value->component->id }}"
                                        value="{{ $componentValue }}">
                                </div>

                                @endif
                            </div>

                            <div class="col-md-3">
                                @if ($value->component->value_type == 'fixed')
                                    <x-forms.input-group>
                                        <x-slot name="prepend" id="currency">
                                            <span
                                                class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                        </x-slot>
                                        <input type="text" class="form-control height-35 f-14"

                                            value="{{ $payrollController->currencyFormatterCustom($value->component->component_value * 12) }}"
                                            readonly>
                                    </x-forms.input-group>
                                @elseif($value->component->value_type == 'percent')
                                    <x-forms.input-group>
                                        <x-slot name="prepend" id="currency">
                                            <span
                                                class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol )}}</span>
                                        </x-slot>
                                        <input type="text" class="form-control height-35 f-14"

                                            value="{{ $payrollController->currencyFormatterCustom(($annualSalary / 12 / 100) * $value->component->component_value * 12) }}"
                                            readonly>
                                    </x-forms.input-group>
                                @elseif($value->component->value_type == 'basic_percent')
                                    <x-forms.input-group>
                                        <x-slot name="prepend" id="currency">
                                            <span
                                                class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                        </x-slot>
                                        <input type="text" class="form-control height-35 f-14" name=""
                                            id="monthBasicPercentage{{ $value->component->id }}"
                                            value="{{ $payrollController->currencyFormatterCustom(($basicSalary / 100) * $value->component->component_value * 12) }}"
                                            readonly>
                                    </x-forms.input-group>
                                @else
                                    <div class="input-group">
                                        <span
                                            class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                        <input type="text" class="form-control height-35 f-14" name=""
                                        id="variableAnuallyDeduction{{ $value->component->id }}"
                                            value="{{ $componentValue * 12 }}"
                                            readonly>
                                    </div>
                                @endif
                            </div>
                        @endif
                    </div>
                </div>
            @endforeach
        @endif
        <div class="row bg-light mt-2">
            <div class="col-md-6">
                <h4 class="heading-h5 mb-0 py-4">
                    @lang('app.total') @lang('payroll::modules.payroll.deduction')
                </h4>
            </div>
            <div class="col-md-3">
                <h4 class="heading-h5 mb-0 py-4">
                    <x-forms.label fieldId="" class="text-dark expenses"
                    :fieldLabel="currency_format($expenses, ($currency->currency ? $currency->currency->id : company()->currency->id ))" />
                    <input type="hidden" name="expenses" class="expenses" value="{{ $expenses }}"/>
                </h4>
            </div>
            <div class="col-md-3">
                <h4 class="heading-h5 mb-0 py-4">
                    <x-forms.label fieldId="" class="text-dark expensesAnnual"
                    :fieldLabel="currency_format($expenses * 12, ($currency->currency ? $currency->currency->id : company()->currency->id ))" />
                </h4>
            </div>
        </div>

    </div>
</div>
<script>
    lastValue = 0;
    yearlySalary = {{ $annualSalary }}

    $(".variable").on("keyup change", function (e) {
        var variable = parseInt($(this).val());
        var totalDeduction = {{ $expenses }};
        var deductionTotalWithoutVar = {{ $deductionTotalWithoutVar }};
        var total = (totalDeduction - deductionTotalWithoutVar) + variable;
        var totalAnnual = total * 12;
        $('.expenses').html(number_format(total));
        $('.expensesAnnual').html(number_format(totalAnnual));
    });

    $('.variable').on('keyup', function (e) {
        var variable = $(this).val();
        var id = $(this).data('type-id');
        var type = $(this).data('type');

        var yearly = (variable.replace(/[,]/g, '') * 12);
        if(type == 'deduction'){
            $('#variableAnuallyDeduction' + id).val(yearly);
        }
        else{
            $('#variableAnually' + id).val(yearly);
        }

        salaryClaculation(variable.replace(/[,]/g, ''));
    })

    $('.select-picker').selectpicker();

    $('.variable').on('keydown', e => {
        lastValue = $(e.target).val();
        lastValue = lastValue.replace(/[,]/g, '');
    });

    function salaryClaculation(variable) {

        var fixed = $('.fixedAllowance').val();

        if (fixed == '' || fixed == 'NaN' || fixed == undefined) {
            fixed = 0;
        }

        if (lastValue == '' || lastValue == 'NaN' || lastValue == undefined) {
            lastValue = 0;
        }

        if (variable == '' || variable == 'NaN' || variable == undefined) {
            variable = 0;
        }

        var newFixed = 0;

        if (lastValue > variable) {
            newFixed = (lastValue - variable) + parseInt(fixed);
        }

        if (lastValue < variable) {
            newFixed = (parseInt(fixed) - (variable - lastValue));
        }

        if (lastValue == variable) {
            newFixed = parseInt(fixed);
        }

        if ((variable == '' || variable == 'NaN' || variable == undefined) && (lastValue == '' || lastValue == 'NaN' ||
            lastValue == undefined)) {
            newFixed = fixed;

        }

        $('.fixedAllowance').val(newFixed);

        var yearlyvariableFix = newFixed * 12;

        $('.monthlyFixedAllowance').html(number_format(newFixed));
        //text-danger

        if(newFixed < 0) {
            $(".monthlyFixedAllowance").addClass("text-danger");
            $(".yearFixedAllowance").addClass("text-danger");
        }
        else{
            $(".monthlyFixedAllowance").removeClass("text-danger");
            $(".yearFixedAllowance").removeClass("text-danger");
        }


        $('.yearFixedAllowance').html(number_format(yearlyvariableFix));
    }

    $("body").tooltip({
        selector: '[data-toggle="tooltip"]'
    })

    function getBasicCalculations() {

        var basicType = $('#basic-type').val();
        var basicValue = $('#basic_value').val();
        var annualSalary = $('#annual_salary').val();
        var userId = $('#user_id').val();

        const url = "{{ route('employee-salary.get_update_salary') }}";
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

    function changeClc() {
        var basicSalary = $('#basic_value').val();
        if(basicSalary > 0){
            getBasicCalculations();
        }
    }
</script>
