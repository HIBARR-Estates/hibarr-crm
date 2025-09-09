<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('payroll::modules.payroll.updateSalary')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <div class="row">

        <div class="col-md-4">
            <div class="form-group">
                <p>
                    <x-employee :user="$employee"/>
                </p>
            </div>
        </div>

        <div class="col-md-4">
            <div class="form-group">
                <x-forms.label :fieldLabel="__('payroll::modules.payroll.currentAnnualGrossSalary')" fieldId="netSalary"/>
                <h6>{{ currency_format(($employeeSalary['netSalary'] * 12), ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h6>
            </div>
        </div>
         <div class="col-md-4">
            <div class="form-group">
                <x-forms.label :fieldLabel="__('payroll::modules.payroll.currentMonthlyGrossSalary')" fieldId="netSalary"/>
                <h6>{{ currency_format($employeeSalary['netSalary'], ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h6>
            </div>
        </div>
    </div>
    <x-form id="updateSalary" method="POST">
        <input type="hidden" name="user_id" value="{{ $employee->id }}"/>
        <div class="form-body">
            <div class="row">
                <div class="col-lg-4">
                    <x-forms.select fieldId="type" :fieldLabel="__('payroll::modules.payroll.valueType')"
                                    fieldName="type" fieldRequired="true">
                        <option value="increment">@lang('payroll::modules.payroll.increment')</option>
                        <option value="decrement">@lang('payroll::modules.payroll.decrement')</option>
                    </x-forms.select>
                </div>
                <div class="col-lg-4">
                    <x-forms.number fieldId="amount" class="annualIncrementAmount" :fieldLabel="__('payroll::modules.payroll.annualIncrementAmount')"
                                    fieldName="annual_salary"
                                    fieldRequired="true">
                    </x-forms.number>
                </div>

                <div class="col-lg-4">
                    <x-forms.datepicker fieldId="date" class="incrementDate" :fieldLabel="__('payroll::modules.payroll.incrementDate')" fieldName="date"
                                        :fieldPlaceholder="__('placeholders.date')"
                                        :fieldValue="now($company->timezone)->format($company->date_format)"/>
                </div>

            </div>
        </div>
    </x-form>
    <div class="row">
        <div class="col-md-4">
            <div class="form-group currentMonthlySalary">
                <x-forms.label :fieldLabel="__('payroll::modules.payroll.incrementMonthlyGrossSalary')" fieldId="currentMonthlySalary"/>
                <h6 id="grossMonthly">{{ currency_format(0, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h6>
            </div>
        </div>
        <div class="col-md-4">
            <div class="form-group">
                <x-forms.label :fieldLabel="__('payroll::modules.payroll.newEffectedYearlySalary')" fieldId="netSalary"/>
                <h6 id="grossAnnual">{{ currency_format(0, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h6>
            </div>
        </div>

        <div class="col-md-4">
            <div class="form-group">
                <x-forms.label :fieldLabel="__('payroll::modules.payroll.newEffectedMonthlySalary')" fieldId="netSalary"/>
                <h6 id="newGrossMonthly">{{ currency_format(0, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h6>
            </div>
        </div>
    </div>
    </div>
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
        $.easyAjax({
            url: "{{ route('employee-salary.increment-store', $employee->id) }}",
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

    $("#amount").on("keyup change", function () {
        var grossSalary = parseInt($(this).val(), 10); // Gross annual increment
        var netSalary = {{ $employeeSalary['netSalary'] }};
        var annualGross = netSalary * 12; // current Gross annual
        var monthlyGross = netSalary; // current Gross monthly

        var monthlyIncrement = grossSalary / 12;

        var type = $('#type').val();

        var newMonthlyGross = 0;
        var newMonthlyIncrement = 0;
        var newAnnualGross = 0;

        if(type == 'increment')
        {
            newMonthlyGross = number_format((monthlyGross + monthlyIncrement).toFixed(2));
            newMonthlyIncrement = number_format(monthlyIncrement.toFixed(2));
            newAnnualGross = number_format((annualGross + grossSalary).toFixed(2));
        }
        else{
            newMonthlyGross = number_format((monthlyGross - monthlyIncrement).toFixed(2));
            newMonthlyIncrement = number_format(monthlyIncrement.toFixed(2));
            newAnnualGross = number_format((annualGross - grossSalary).toFixed(2));
        }

        $('#newGrossMonthly').html(newMonthlyGross);
        $('#grossMonthly').html(newMonthlyIncrement);
        $('#grossAnnual').html(newAnnualGross);
    });

    $("#type").on("change", function (e) {
        var type = $(this).val();
        var typeName = type;
        var incrementDate = '';
        if(type == 'increment')
        {
            typeName = "{{ __('payroll::modules.payroll.annualIncrementAmount') }}"
            incrementDate = "{{ __('payroll::modules.payroll.incrementDate') }}"
            incrementCurrentSalary = "{{ __('payroll::modules.payroll.incrementMonthlyGrossSalary') }}"
        }
        else{
            typeName = "{{ __('payroll::modules.payroll.annualDecrementAmount') }}"
            incrementDate = "{{ __('payroll::modules.payroll.decrementDate') }}"
            incrementCurrentSalary = "{{ __('payroll::modules.payroll.decrementMonthlyGrossSalary') }}"
        }

        $('.annualIncrementAmount label').html(typeName);
        $('.incrementDate label').html(incrementDate);
        $('.currentMonthlySalary label').html(incrementCurrentSalary);
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

</script>
