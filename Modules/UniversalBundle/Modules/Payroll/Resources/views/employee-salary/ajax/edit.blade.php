<div class="row">
    <div class="col-sm-12">
        <x-form id="update-salary-form">
            <x-cards.data :title="__('payroll::modules.payroll.updateSalary')" class="add-client">

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

                                <input type="hidden" name="user_id" id="user_id" value="{{ $employeeMonthlySalary->user_id }}">
                                <input type="hidden" name="type" id="type" value="initial">
                            </div>

                            <div class="col-md-4">
                                <x-forms.input-group class="mt-2">

                                    <x-slot name="prepend" id="currency">
                                        <span
                                            class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                    </x-slot>

                                    <input type="number" class="form-control height-35 f-14" name="annual_salary" readonly

                                           id="annual_salary" value="{{ $employeeMonthlySalary->effective_annual_salary }}">
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
                                <div class="row">
                                    <div class="col-md-3">
                                        <x-forms.label fieldId=""
                                                    :fieldLabel="__('payroll::modules.payroll.basicPay')">
                                        </x-forms.label>
                                    </div>
                                    <div class="col-md-3">

                                        <x-forms.input-group>
                                            <input type="number" value="{{ $employeeMonthlySalary->basic_salary }}" name="basic_salary" id="basic_value"
                                                class="form-control height-35 f-15 tttt"  style="width:30%" value="50">

                                        <select name="basic_value" id="basic-type"  onchange="selectType(this.value)" class="form-control select-picker" data-size="8">
                                            <option @if($employeeMonthlySalary->basic_value_type == 'fixed') selected @endif value="fixed">@lang('payroll::modules.payroll.fixed')</option>
                                            <option @if($employeeMonthlySalary->basic_value_type == 'ctc_percent') selected @endif value="ctc_percent">@lang('payroll::modules.payroll.percentOfCTC')</option>
                                        </select>
                                        </x-forms.input-group>

                                    </div>
                                    @if($employeeMonthlySalary->basic_value_type == 'fixed')
                                        <div class="col-md-3">
                                            <x-forms.input-group>
                                                <x-slot name="prepend" id="currency">
                                                    <span
                                                        class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                                </x-slot>
                                                <input type="text" class="form-control height-35 f-14" name="basic_type" id="basic_type"
                                                    value="{{ $payrollController->currencyFormatterCustom($employeeMonthlySalary->basic_salary) }}" readonly>
                                            </x-forms.input-group>
                                        </div>
                                        <div class="col-md-3">
                                            <x-forms.input-group>
                                                <x-slot name="prepend" id="currency">
                                                    <span
                                                        class="input-group-text f-14 bg-white-shade">{{ ($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol ) }}</span>
                                                </x-slot>
                                                <input type="text" class="form-control height-35 f-14"
                                                    value="{{ $payrollController->currencyFormatterCustom($employeeMonthlySalary->basic_salary * 12) }}" readonly>

                                            </x-forms.input-group>
                                        </div>
                                    @else
                                        @php
                                            $basicSalary = ($employeeMonthlySalary->effective_annual_salary / 12) / 100 * $employeeMonthlySalary->basic_salary;
                                        @endphp
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
                                    @endif
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
                                                    <x-forms.label fieldId="" :fieldLabel="$value->component->component_name" />
                                                </div>
                                                <div class="col-md-3">
                                                    @if ($value->component->value_type == 'basic_percent')
                                                        <x-forms.label fieldId="" :fieldLabel="($value->component->component_value.' '.__('payroll::modules.payroll.percentOfBasic'))" />
                                                    @else
                                                        <x-forms.label fieldId="" :fieldLabel="$value->component->value_type ?? '--'" />
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

                                                                value="{{ $payrollController->currencyFormatterCustom(($employeeMonthlySalary->effective_annual_salary / 12 / 100) * $value->component->component_value) }}"
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

                                                                value="{{ $payrollController->currencyFormatterCustom(($employeeMonthlySalary->effective_annual_salary / 12 / 100) * $value->component->component_value * 12) }}"
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
                                                    :fieldLabel="__('payroll::modules.payroll.fixedAllowance')"
                                                    fieldRequired="">
                                        </x-forms.label>
                                        <p class="f-11 text-grey">@lang('payroll::modules.payroll.extraPay')</p>
                                    </div>
                                    <div class="col-md-3">

                                        <x-forms.label fieldId="" :fieldLabel="__('payroll::modules.payroll.fixedAllowance')" />

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
                            {{-- </div> --}}

                            <div class="col-md-12 salary-total mt-2 rounded bg-light">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h3 class="heading-h3 mb-0 py-4">
                                            @lang('payroll::modules.payroll.costToCompany')</h3>
                                    </div>
                                    <div class="col-md-3">
                                        <h3 class="heading-h3 mb-0 py-4">
                                             {{ currency_format($employeeMonthlySalary->effective_annual_salary / 12, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h4>
                                    </div>
                                    <div class="col-md-3">
                                        <h3 class="heading-h3 mb-0 py-4">
                                            {{ currency_format($employeeMonthlySalary->effective_annual_salary, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h4>
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
                                                $componentValueDeduction = $compValue->variable_value;
                                            }
                                            else{
                                                $componentValueDeduction = $value->component->component_value;
                                            }
                                        @endphp
                                        <div class="col-md-12 mt-1">
                                            <div class="row">
                                                @if ($value->component->component_type == 'deduction')
                                                    <div class="col-md-3">
                                                        <x-forms.label fieldId="" :fieldLabel="$value->component->component_name" />
                                                    </div>
                                                    <div class="col-md-3">
                                                        @if ($value->component->value_type == 'basic_percent')
                                                            <x-forms.label fieldId="" :fieldLabel="($value->component->component_value.' '.__('payroll::modules.payroll.percentOfBasic'))" />
                                                        @else
                                                            <x-forms.label fieldId="" :fieldLabel="$value->component->value_type ?? '--'" />
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

                                                                    value="{{ $payrollController->currencyFormatterCustom(($employeeMonthlySalary->effective_annual_salary / 12 / 100) * $value->component->component_value) }}"
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

                                                                <input type="text" class="form-control height-35 f-14 variable-deduction" data-type="deduction" data-type-id="{{ $value->component->id }}"
                                                                    name="deduction_variable[{{ $value->component->id }}]" id="deductionVariable{{ $value->component->id }}"
                                                                    value="{{ $componentValueDeduction }}">
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

                                                                    value="{{ $payrollController->currencyFormatterCustom(($employeeMonthlySalary->effective_annual_salary / 12 / 100) * $value->component->component_value * 12) }}"
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
                                                                    value="{{ $componentValueDeduction * 12 }}"
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
                    </div>
                </div>

                <div class='w-100 d-block d-lg-flex d-md-flex justify-content-start pt-3'>
                    <x-forms.button-primary id="update-employee-salary" class="mr-3" icon="check">@lang('app.save')
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="route('employee-salary.index')" class="border-0">@lang('app.cancel')
                    </x-forms.button-cancel>
                </div>
            </x-cards.data>
        </x-form>

    </div>
</div>
<script>

    $(document).ready(function () {

        $('.select-picker').selectpicker();

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

        let timeout;
        function changeClc() {
            clearTimeout(timeout); // Make a new timeout set to go off in 800ms timeout = setTimeout(function() { // Put your code here that you want to run // after the user has stopped typing for a little bit }, 800);

            timeout = setTimeout(function() {
                var basicSalary = $('#basic_value').val();
                if($('#basic-type').val() == 'ctc_percent' && basicSalary > 100){
                    $('#basic_value').val(100);
                }
                if(basicSalary > 0){
                    getBasicCalculations();
                }

            }, 800);
        }


        $("#annual_salary").on("keyup change", function (e) {
            var annualSalary = $(this).val();
            var monthlySalary = annualSalary / 12;
            let netMonthlySalary = number_format(monthlySalary.toFixed(2));
            $('#monthly_salary').html(netMonthlySalary);
            changeClc();
        });

        $("#components #basic_value").on("keyup change", function (e) {
            changeClc();
        });

        changeClc();

    });


    $(".variable-deduction").on("keyup change", function (e) {
        var variable = parseInt($(this).val());
        var totalDeduction = {{ $expenses }};
        var deductionTotalWithoutVar = {{ $deductionTotalWithoutVar }};
        var total = (totalDeduction - deductionTotalWithoutVar) + variable;
        var totalAnnual = total * 12;
        $('.expenses').html(number_format(total));
        $('.expensesAnnual').html(number_format(totalAnnual));
    });

    function selectType(vals) {
        getBasicCalculations();
    }


    $('body').on('click', '#update-employee-salary', function () {
        const url = "{{route('employee-salary.update-salary', $employeeMonthlySalary->id)}}";

        $.easyAjax({
            url: url,
            container: '#update-salary-form',
            type: "POST",
            blockUI: true,
            disableButton: true,
            buttonSelector: "#update-employee-salary",
            data: $('#update-salary-form').serialize(),
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
<script>
    lastValue = 0;
    yearlySalary = {{ $employeeMonthlySalary->effective_annual_salary }}
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
        console.log(newFixed);
        $('.fixedAllowance').val(newFixed);

        var yearlyvariableFix = newFixed * 12;

        if(newFixed > 0){
            $('.monthlyFixedAllowance').html(number_format(newFixed));
        }
        else{
            $('.monthlyFixedAllowance').html(number_format(0));
        }

        if(newFixed < 0) {
            $(".monthlyFixedAllowance").addClass("text-danger");
            $(".yearFixedAllowance").addClass("text-danger");
        }
        else{
            $(".monthlyFixedAllowance").removeClass("text-danger");
            $(".yearFixedAllowance").removeClass("text-danger");
        }
        alert('test');

        $('.yearFixedAllowance').html(number_format(yearlyvariableFix));
    }
</script>
