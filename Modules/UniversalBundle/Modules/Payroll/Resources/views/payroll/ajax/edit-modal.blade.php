<style>
    .fixed {
        margin-left: 535px;
    }
</style>
<div class="row">
    <div class="col-sm-12">
        <x-form id="save-payroll-form" method="PUT">
            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                    @lang('app.edit') @lang('payroll::modules.payroll.salarySlip')</h4>
                <div class="row p-20">
                    <div class="col-12 mb-4">
                        <h4>@lang('payroll::modules.payroll.salarySlipHeading') {{ \Carbon\Carbon::parse($salarySlip->year.'-'.$salarySlip->month.'-01')->format('F Y') }}</h4>
                    </div>
                    <div class="col-6">
                            <x-cards.data-row :label="__('modules.employees.fullName')"
                                              :value="ucwords($salarySlip->user->name)" html="true"/>
                            <x-cards.data-row :label="__('modules.employees.employeeId')"
                                              :value="$salarySlip->user->employeeDetail->employee_id" html="true"/>
                            <x-cards.data-row :label="__('app.designation')"
                                              :value="(!is_null($salarySlip->user->employeeDetail->designation)) ? $salarySlip->user->employeeDetail->designation->name : '-'"
                                              html="true"/>
                    </div>
                    <div class="col-6">
                        <x-cards.data-row :label="__('modules.employees.joiningDate')"
                                          :value="$salarySlip->user->employeeDetail->joining_date->format($company->date_format)"
                                          html="true"/>
                        <x-cards.data-row :label="__('payroll::modules.payroll.salaryGroup')"
                                          :value="(!is_null($salarySlip->salary_group)) ? $salarySlip->salary_group->group_name : '-'"
                                          html="true"/>
                    </div>
                </div>
                <div class="border-bottom-grey"></div>

                <div class="row p-20">

                    <div class="col-md-3">
                        <x-forms.datepicker fieldId="paid_on" :fieldLabel="__('modules.payments.paidOn')"
                                            fieldName="paid_on" :fieldPlaceholder="__('placeholders.date')"
                                            :fieldValue="$salarySlip->paid_on ? $salarySlip->paid_on->format($company->date_format) : ''"/>
                    </div>

                    <div class="col-md-3">
                        <x-forms.select fieldId="salary_payment_method_id"
                                        :fieldLabel="__('payroll::modules.payroll.salaryPaymentMethod')"
                                        fieldName="salary_payment_method_id"
                                        search="true">
                            <option value="">--</option>
                            @foreach($salaryPaymentMethods as $item)
                                <option
                                    @if($item->id == $salarySlip->salary_payment_method_id) selected @endif
                                value="{{ $item->id }}">{{ $item->payment_method }}</option>
                            @endforeach
                        </x-forms.select>
                    </div>

                    <div class="col-md-3">
                        <x-forms.select fieldId="status" :fieldLabel="__('app.status')" fieldName="status"
                                        search="true">
                            <option @if($salarySlip->status == 'generated') selected @endif
                            value="generated">{{ __('payroll::modules.payroll.generated') }}</option>
                            <option @if($salarySlip->status == 'review') selected @endif
                            value="review">{{ __('payroll::modules.payroll.review') }}</option>
                            <option @if($salarySlip->status == 'locked') selected @endif
                            value="locked">{{ __('payroll::modules.payroll.locked') }}</option>
                            <option @if($salarySlip->status == 'paid') selected @endif
                            value="paid">{{ __('payroll::modules.payroll.paid') }}</option>
                        </x-forms.select>
                    </div>

                    <div class="col-lg-3 col-md-3">
                        <x-forms.text :fieldLabel="__('payroll::modules.payroll.expenseClaims')"
                                      fieldName="expense_claims"
                                      fieldId="expense_claims"
                                      :fieldPlaceholder="__('payroll::modules.payroll.expenseClaims')"
                                      :fieldValue="$salarySlip->expense_claims"/>
                    </div>
                </div>
                <div class="row p-20">

                    <div class="col-lg-6 col-md-6">
                        <div class="table-responsive py-3" id="earning-table">
                            <table width="100%">
                                <tbody>
                                <tr class="text-dark-grey font-weight-bold f-14">
                                    <th class="pr-2 text-uppercase">@lang('payroll::modules.payroll.earning')</th>
                                    <th class="text-right text-uppercase">@lang('app.amount')</th>
                                    <th class="text-right"></th>
                                </tr>

                                <tr>
                                    <td class="pr-2">@lang('payroll::modules.payroll.basicPay') </td>
                                    <td class="text-right" >
                                        <input type="number" min="0" step=".01"
                                               class="form-control text-right height-35 f-14 my-2" id="basic-salary"
                                               name="basic_salary" value="{{ $basicSalary }}">
                                    </td>
                                    <td>

                                    </td>

                                </tr>

                                @foreach ($earnings as $key=>$item)
                                    @if($key != 'Total Hours')
                                        <tr>
                                            <td class="pr-2">{{ $key }}</td>
                                            <td class="text-right">
                                                <input type="hidden" class="form-control" name="earnings_name[]"
                                                    value="{{ $key }}">
                                                <input type="number" min="0" step=".01"
                                                    class="form-control text-right height-35 f-14 my-2" name="earnings[]"
                                                    value="{{ $item }}">
                                            </td>
                                            <td></td>
                                        </tr>
                                    @endif
                                @endforeach

                                @foreach ($earningsExtra as $key=>$item)
                                @if($key != 'Total Hours')
                                    <tr>
                                        <td class="pr-2"><input type="text" class="form-control height-35 f-14 my-2"
                                                                name="extra_earnings_name[]" value="{{ $key }}"></td>
                                        <td class="text-right">
                                            <input type="number" min="0" step=".01" id="extraValue{{$loop->iteration}}"
                                                   class="form-control text-right extraValue height-35 f-14 my-2"
                                                   name="extra_earnings[]" value="{{ $item }}">
                                        </td>
                                        <td>
                                            <a href="javascript:;"  data-iteration="extraValue{{$loop->iteration}}"  data-type="extra" id="extraRemove{{$loop->iteration}}"
                                               class="d-flex align-items-center extraRemove 0 remove-item"><i
                                                    class="fa fa-times-circle f-20 text-lightest"></i></a>
                                        </td>
                                    </tr>
                                @endif
                                @endforeach
                                <tr id="fixedAllowanceTr">
                                    <td class="pr-2">@lang('payroll::modules.payroll.fixedAllowance')</td>
                                    <td class="text-right">
                                        @php
                                            $fixedAllow = ($salarySlip->fixed_allowance > 0) ? $salarySlip->fixed_allowance : $fixedAllowance;
                                        @endphp
                                        <input type="hidden" min="0" step=".01" id="fixed_allowance_input"
                                               name="fixed_allowance_input" value="{{ $fixedAllow }}">
                                        <input type="number" min="0" step=".01" disabled
                                               class="form-control text-right height-35 f-14 my-2 fixedAllowance"
                                               name="fixed" id="fixed" value="{{ $fixedAllow }}">
                                    </td>
                                    <td>

                                    </td>
                                </tr>

                                </tbody>
                            </table>
                        </div>
                        <div class="row">
                            <div class="col-md-12">
                                <a class="f-15 f-w-500" href="javascript:;" id="add-earning"><i
                                        class="icons icon-plus font-weight-bold mr-1"></i>@lang('app.add')</a>
                            </div>
                        </div>
                        <hr/>
                        <div class="row">
                            <div class="col-md-12 ">
                                <table id="additionalDataBox" width="100%">
                                    <tbody>
                                        @foreach ($earningsAdditional as $key=>$item)
                                            <tr>
                                                <td class="pr-2"><input type="text" class="form-control height-35 f-14 my-2"
                                                                        name="additional_name[]" value="{{ $key }}"></td>
                                                <td class="text-right">
                                                    <input type="number" min="0" step=".01" id="additionalValue{{$loop->iteration}}"
                                                        class="form-control additionalValue text-right height-35 f-14 my-2"
                                                        name="additional_earnings[]" value="{{ $item }}">
                                                </td>
                                                <td>
                                                    <a href="javascript:;" data-iteration="additionalValue{{$loop->iteration}}"  data-type="additional" id="additionalRemove{{$loop->iteration}}"
                                                    class="d-flex align-items-center additionalRemove 0 remove-item"><i
                                                            class="fa fa-times-circle f-20 text-lightest"></i></a>
                                                </td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-12">
                                <a class="f-15 f-w-500" href="javascript:;" id="add-additional-earning"><i
                                        class="icons icon-plus font-weight-bold mr-1"></i>@lang('payroll::app.addAdditionalEarning')</a>
                            </div>
                        </div>
                        <hr/>

                    </div>

                    <div class="col-lg-6 col-md-6">
                        <div class="table-responsive py-3" id="deduction-table">
                            <table width="100%">
                                <tbody>
                                <tr class="text-dark-grey font-weight-bold f-14">
                                    <th class="pr-2 text-uppercase">@lang('payroll::modules.payroll.deduction')</th>
                                    <th class="text-right text-uppercase">@lang('app.amount')</th>
                                    <th class="text-right"></th>
                                </tr>
                                @foreach ($deductions as $key=>$item)
                                    <tr>
                                        <td class="pr-2">{{ $key }}</td>
                                        <td class="text-right">
                                            <input type="hidden" class="form-control" name="deductions_name[]"
                                                   value="{{ $key }}">
                                            <input type="number" min="0" step=".01"
                                                   class="form-control text-right height-35 f-14 my-2"
                                                   name="deductions[]" value="{{ $item }}">
                                        </td>
                                        <td></td>
                                    </tr>
                                @endforeach
                                @foreach ($deductionsExtra as $key=>$item)
                                    <tr>
                                        <td class="pr-2"><input type="text" class="form-control height-35 f-14 my-2"
                                                                name="extra_deductions_name[]" value="{{ $key }}"></td>
                                        <td class="text-right">
                                            <input type="number" min="0" step=".01"
                                                   class="form-control text-right height-35 f-14 my-2"
                                                   name="extra_deductions[]" value="{{ $item }}">
                                        </td>
                                        <td>
                                            <a href="javascript:;"
                                               class="d-flex align-items-center justify-content-end remove-item"><i
                                                    class="fa fa-times-circle f-20 text-lightest"></i></a>
                                        </td>
                                    </tr>

                                @endforeach
                                </tbody>
                            </table>
                        </div>
                        <div class="row">
                            <div class="col-md-12">
                                <a class="f-15 f-w-500" href="javascript:;" id="add-deduction"><i
                                        class="icons icon-plus font-weight-bold mr-1"></i>@lang('app.add')</a>
                            </div>
                        </div>
                    </div>
                    <hr/>
                    <div class="col-lg-12 col-md-12 mt-4">
                        <h3 class="text-center">
                            <input type="hidden" id="grossSalary" name="gross_salary" value="{{ $salarySlip->gross_salary }}">

                            <strong class="text-uppercase m-r-20">@lang('payroll::modules.payroll.netSalary'):</strong>
                            <span id="net-salary" data-value = {{ $salarySlip->net_salary }}>{{ currency_format($salarySlip->net_salary, $salarySlip->currency_id) }}</span>
                        </h3>
                        <h5 class="text-center text-muted">@lang('payroll::modules.payroll.netSalary') =
                            (@lang('payroll::modules.payroll.grossEarning')
                            - @lang('payroll::modules.payroll.totalDeductions')
                            + @lang('payroll::modules.payroll.reimbursement'))</h5>
                    </div>

                </div>

                <div class="w-100 border-top-grey d-flex justify-content-end px-4 py-3">
                    <x-forms.button-cancel :link="route('payroll.index')" class="border-0 mr-3">@lang('app.cancel')
                    </x-forms.button-cancel>
                    <x-forms.button-primary id="save-payroll" icon="check">@lang('app.save')
                    </x-forms.button-primary>
                </div>

            </div>
        </x-form>

    </div>
</div>


<script>

    $(document).ready(function () {

        const dp1 = datepicker('#paid_on', {
            position: 'bl',
            ...datepickerConfig
        });

        $('#save-payroll').click(function () {

            const url = "{{route('payroll.update', $salarySlip->id)}}";

            $.easyAjax({
                url: url,
                container: '#save-payroll-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#save-payroll",
                data: $('#save-payroll-form').serialize(),
                success: function (response) {
                    console.log(response);
                    window.location.href = response.url;
                }
            });
        });

        init(RIGHT_MODAL);

        $('#add-earning').click(function () {
            var numItems = $('.extraValue').length + 1;
            var earning = '<tr>' +
                '<td class="pr-2"><input type="text" class="form-control height-35 f-14 my-2" name="extra_earnings_name[]"></td>' +
                '<td><input type="number" min="0" id="extraValue'+numItems+'"  value="0" step=".01" class="form-control text-right height-35 f-14 my-2" name="extra_earnings[]"></td>' +
                '<td><a href="javascript:;"  data-iteration="extraValue'+numItems+'"  data-type="extra" id="extraRemove'+numItems+'" class="d-flex align-items-center justify-content-start extraValue remove-item"><i class="fa fa-times-circle f-20 text-lightest"></i></a></td></tr>';
            $('#earning-table tbody').append(earning);
        });

        $('#add-additional-earning').click(function () {
            var numItems = $('.additionalValue').length + 1;

            var earning = '<tr>' +
                '<td class="pr-2"><input type="text" class="form-control height-35 f-14 my-2" name="additional_name[]"></td>' +
                '<td><input type="number" min="0" value="0" id="additionalValue'+numItems+'" step=".01" class="form-control text-right height-35 f-14 my-2" name="additional_earnings[]"></td>' +
                '<td><a href="javascript:;" data-iteration="additionalValue'+numItems+'" data-type="additional" id="additionalRemove'+numItems+'" class="d-flex align-items-center additionalValue justify-content-start remove-item"><i class="fa fa-times-circle f-20 text-lightest"></i></a></td></tr>';
            $('#additionalDataBox tbody').append(earning);
        });


        $('#add-deduction').click(function () {
            var earning = '<tr>' +
                '<td class="pr-2"><input type="text" class="form-control height-35 f-14 my-2" name="extra_deductions_name[]"></td>' +
                '<td><input type="number" min="0" value="0" step=".01" class="form-control text-right height-35 f-14 my-2" name="extra_deductions[]"></td>' +
                '<td><a href="javascript:;" class="d-flex align-items-center justify-content-end remove-item"><i class="fa fa-times-circle f-20 text-lightest"></i></a></td></tr>';
            $('#deduction-table tbody').append(earning);
        });

        $('body').on('click', '.remove-item', function (e) {

            var value = 0;
            var type = '';

            if(e.target.closest('a').id != undefined && e.target.closest('a').id != "")
            {
                var targetId = e.target.closest('a').id;
                var iteration  = $('#'+targetId).data('iteration');
                type  = $('#'+targetId).data('type');
                value  = $('#'+iteration).val();
            }
            var additionalOldEarning = 0;

            $("input[name='additional_earnings[]']").map(function () {
                let earning = $(this).val();
                if(earning == '' || earning === undefined){
                    earning = 0;
                }
                additionalOldEarning = parseFloat(additionalOldEarning  ) + parseFloat(earning);
            }).get();

            $(this).closest('tr').remove();
            calculateNetSalary(e.target.id, value, type, additionalOldEarning);

        });

        $('body').on('keyup', "input[name='earnings[]'], input[name='deductions[]'], input[name='extra_earnings[]'], input[name='additional_earnings[]'],  input[name='extra_deductions[]'],  #basic-salary, #expense_claims, #fixed" , function (e) {
            calculateNetSalary(e.target.id, 0, 'add', 0);
        });

        var OldAdditionalEarning = {{$earningsAdditionalTotal}};

        function calculateNetSalary(elementID, targetValue, type, additionalOldEarning) {

            if(targetValue == undefined || targetValue == '')
            {
                targetValue = 0;
            }

            targetValue = parseFloat(targetValue);

            let grossEarning = parseFloat($('#basic-salary').val());
            let inputGrossSalary = parseFloat($('#grossSalary').val());

            let grossSalary = parseFloat(inputGrossSalary);

            if(type == 'additional')
            {
                grossSalary = grossSalary - targetValue;
            }

            if(grossEarning == '' || grossEarning === undefined){
                grossEarning = 0;
            }

            let salary = $('#net-salary').data('value');
            let totalDeductions = 0;
            let totalExtraEarning = 0;
            let reimbursement = $('#expense_claims').val();

            if(reimbursement == '' || reimbursement === undefined){
                reimbursement = 0;
            }

            let fixedAllowence = $('#fixed').text();

            if(fixedAllowence == '' || fixedAllowence === undefined){
                fixedAllowence = 0;
            }

            // Reimbursement
            reimbursement = parseFloat(reimbursement);

            // getting Earnings
            $("input[name='earnings[]']").map(function () {
                let earning = $(this).val();
                if(earning == '' || earning === undefined){
                    earning = 0;
                }
                grossEarning = parseFloat(grossEarning) + parseFloat(earning);
            }).get();

            // getting Deductions
            $("input[name='deductions[]']").map(function () {
                let deductions = $(this).val();
                if(deductions == '' || deductions === undefined){
                    deductions = 0;
                }
                totalDeductions = parseFloat(totalDeductions) + parseFloat(deductions);
            }).get();

            // Getting Extra Earning
            $("input[name='extra_earnings[]']").map(function () {
                let earning = $(this).val();
                if(earning == '' || earning === undefined){
                    earning = 0;
                }

                grossEarning = parseFloat(grossEarning) + parseFloat(earning);
            }).get();

            // Getting Additional Earning Like Bonus
            $("input[name='additional_earnings[]']").map(function () {
                let earning = $(this).val();
                if(earning == '' || earning === undefined){
                    earning = 0;
                }
                totalExtraEarning = parseFloat(totalExtraEarning) + parseFloat(earning);

            }).get();

            grossSalary = parseFloat(inputGrossSalary) - parseFloat(OldAdditionalEarning);
            grossSalary = parseFloat(grossSalary) + parseFloat(totalExtraEarning);

            OldAdditionalEarning = totalExtraEarning;

            $("input[name='extra_deductions[]']").map(function () {
                let deductions = $(this).val();
                if(deductions == '' || deductions === undefined){
                    deductions = 0;
                }
                totalDeductions = parseFloat(totalDeductions) + parseFloat(deductions);
            }).get();

            let fixed = 0;

            if(elementID != 'fixed'){

                grossSalary = parseFloat(grossSalary) - parseFloat(totalExtraEarning);

                fixed = (grossSalary - grossEarning);

                grossSalary = parseFloat(grossSalary) + parseFloat(totalExtraEarning);

            }
            else{
                fixed = (salary - grossEarning + reimbursement );
            }

            let netSalary = (grossEarning - totalDeductions + reimbursement + totalExtraEarning);

            if(fixed < 0){
                fixed = 0;
            }

            let netFixed = (fixed.toFixed(2));
            let netSalaryFixed = (netSalary + fixed);
            let formatedSalary = number_format(netSalaryFixed.toFixed(2));

            targetValue = 0;

            $('#net-salary').html(formatedSalary);
            $('#fixed').val(netFixed);
            $('#fixed_allowance_input').val(fixed);
            $('#grossSalary').val(grossSalary);
        }


        function number_format(number) {
            let decimals = '{{currency_format_setting()->no_of_decimal}}';
            let thousands_sep = '{{currency_format_setting()->thousand_separator}}';
            let currency_position = '{{currency_format_setting()->currency_position}}';
            let dec_point = '{{currency_format_setting()->decimal_separator}}';
            // Strip all characters but numerical ones.
            number = (number + '').replace(/[^0-9+\-Ee.]/g, '');

            var currency_symbol = '{{($currency->currency ? $currency->currency->currency_symbol : company()->currency->currency_symbol )}}';


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
    });

</script>
