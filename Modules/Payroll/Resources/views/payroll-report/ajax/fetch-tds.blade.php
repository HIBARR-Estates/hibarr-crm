<div class="content-wrapper">
    <div class="d-flex flex-column">
        <div class="row mb-4">
            <div class="col-lg-3">
                <x-cards.widget :title="__('payroll::modules.payroll.tdsCharged')" value="{{  currency_format($tdsAlreadyPaid, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}"
                                    icon="coins" widgetId="jobApp"/>
            </div>
        </div>
    </div>

    <div class="card bg-white border-0 b-shadow-4">
        <div class="card-body">
            <div class="row">
                <div class="col-xl-9 col-lg-8 col-md-12 mb-4 mb-xl-0 mb-lg-4 mb-md-0">
                    @php
                        $startMonthIndex = json_decode($payrollSetting->finance_month);
                        $endMonthIndex = ($startMonthIndex - 1) <= 0 ? 12 : ($startMonthIndex - 1);
                        $result = Carbon\CarbonPeriod::create(
                            Carbon\Carbon::createFromDate(null, $startMonthIndex)->format('Y-m'),
                            '1 month',
                            Carbon\Carbon::createFromDate(null, $endMonthIndex)->addYear()->format('Y-m')
                        );
                    @endphp
                    <div class="table-responsive p-20">
                        <div id="table-actions" class="d-block d-lg-flex align-items-center">
                            <h5>@lang('payroll::modules.payroll.monthlyTDS')</h5>
                        </div>
                        <x-table class="table-bordered">
                            <x-slot name="thead">
                                <th>@lang('app.month')</th>
                                <th>@lang('payroll::modules.payroll.tds')</th>
                            </x-slot>
                            
                            @foreach($result as $date)
                                <tr>
                                    <td>{{ $date->translatedFormat('F Y') }}</td>
                                    <td>
                                        @if(isset($main[$date->format('n')]))
                                            {{  currency_format($main[$date->format('n')], ($currency->currency ? $currency->currency->id : company()->currency->id )) }}
                                        @else
                                            -
                                        @endif
                                    </td>
                                </tr>
                            @endforeach
                        </x-table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>