@section('content')
<!-- CONTENT WRAPPER START -->
<div class="content-wrapper">
    <div class="row mb-4">
        <div class="col-lg-3">
            <x-cards.widget :title="__('payroll::modules.payroll.totalTdsPaid')" value="{{ currency_format($totalTdsPaid, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}"
                                icon="coins" widgetId="tds"/>
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
                            @lang('payroll::modules.payroll.monthlyTDS')
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
                                        @if(isset($totalArr[$date->format('n')]))
                                            {{ currency_format($totalArr[$date->format('n')], ($currency->currency ? $currency->currency->id : company()->currency->id )) }}
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
<!-- CONTENT WRAPPER END -->

@endsection

@push('scripts')
    
@endpush
