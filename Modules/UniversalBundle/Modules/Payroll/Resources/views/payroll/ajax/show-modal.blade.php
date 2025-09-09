<div id="payroll-detail-section">
    <div class="row">
        <div class="col-sm-12">
            <div class="card bg-white border-0 b-shadow-4">
                <div class="card-header bg-white border-bottom-grey  justify-content-between p-20">
                    <div class="row">
                        <div class="col-md-10">
                            <h3 class="heading-h3">@lang('payroll::modules.payroll.salarySlip')</h3>
                            <h5 class="text-lightest">@lang('payroll::modules.payroll.salarySlipHeading') {{ $salarySlip->duration }} @if(!is_null($salarySlip->payroll_cycle))
                                    ({{ __('payroll::app.menu.'.$salarySlip->payroll_cycle->cycle) }}) @endif
                            </h5>
                        </div>
                        <div class="col-md-2 text-right">
                            <div class="dropdown">
                                <button
                                    class="btn btn-lg f-14 px-2 py-1 text-dark-grey  rounded dropdown-toggle"
                                    type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                    <i class="fa fa-ellipsis-h"></i>
                                </button>

                                <div class="dropdown-menu dropdown-menu-right border-grey rounded b-shadow-4 p-0"
                                     aria-labelledby="dropdownMenuLink" tabindex="0">
                                    @if ($salarySlip->status != 'paid' && (user()->permission('edit_payroll') == 'all' || user()->permission('edit_payroll') == 'added'))
                                        <a class="dropdown-item openRightModal"
                                           href="{{ route('payroll.edit', $salarySlip->id) }}">@lang('app.edit')</a>
                                    @endif
                                    <a class="dropdown-item"
                                       href="{{ route('payroll.download_pdf', md5($salarySlip->id)) }}">@lang('app.download')</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="col-12 px-0 pb-3 d-lg-flex">
                                <p class="mb-0 text-lightest f-14 w-30 d-inline-block ">
                                    @lang('app.employee') @lang('app.name')</p>
                                <p class="mb-0 text-dark-grey f-14">
                                    <x-employee :user="$salarySlip->user"/>
                                </p>
                            </div>
                            <x-cards.data-row :label="__('app.designation')"
                                :value="(!is_null($salarySlip->user->employeeDetail->designation)) ? $salarySlip->user->employeeDetail->designation->name : '-'" />
                            <x-cards.data-row :label="__('app.department')"
                                :value="(!is_null($salarySlip->user->employeeDetail->department)) ? $salarySlip->user->employeeDetail->department->team_name : '-'" />
                            <x-cards.data-row :label="__('payroll::modules.payroll.salaryPaymentMethod')"
                                :value="($salarySlip->salary_payment_method_id) ? $salarySlip->salary_payment_method->payment_method : '--'" />
                        </div>
                        <div class="col-md-4">
                            <x-cards.data-row :label="__('modules.employees.employeeId')"
                                              :value="$salarySlip->user->employeeDetail->employee_id"/>

                            <x-cards.data-row :label="__('modules.employees.joiningDate')"
                                              :value="$salarySlip->user->employeeDetail->joining_date->translatedFormat($company->date_format)"/>

                            <x-cards.data-row :label="__('modules.payments.paidOn')"
                                              :value="($salarySlip->paid_on) ? $salarySlip->paid_on->translatedFormat($company->date_format) : '--'"/>

                            <div class="col-12 px-0 pb-3 d-block d-lg-flex d-md-flex">
                                <p class="mb-0 text-lightest f-14 w-30 d-inline-block ">
                                    @lang('app.status')</p>
                                <p class="mb-0 text-dark-grey f-14 w-70">
                                    @if ($salarySlip->status == 'generated')
                                        <x-status :value="__('payroll::modules.payroll.generated')" color="green"/>
                                    @elseif ($salarySlip->status == 'review')
                                        <x-status :value="__('payroll::modules.payroll.review')" color="blue" />
                                    @elseif ($salarySlip->status == 'locked')
                                        <x-status :value="__('payroll::modules.payroll.locked')" color="red" />
                                    @elseif ($salarySlip->status == 'paid')
                                        <x-status :value="__('payroll::modules.payroll.paid')"
                                                  color="dark-green"/>
                                    @endif
                                </p>
                            </div>

                            <x-cards.data-row :label="__('payroll::modules.payroll.generatedOn')"
                                              :value="($salarySlip->created_at) ? $salarySlip->created_at->translatedFormat($company->date_format) : '--'"/>

                        </div>

                        <div class="col-md-2">
                            <div class="text-center border rounded p-20">
                                <small>@lang('payroll::modules.payroll.employeeNetPay')</small>
                                <h4 class="text-primary heading-h3 mt-1">{{ currency_format($salarySlip->net_salary, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h4>
                            </div>
                        </div>
                    </div>

                    <x-forms.custom-field-show :fields="$fields" :model="$employeeDetail"></x-forms.custom-field-show>

                    <div class="row">
                        <div class="col-md-6">

                            <div class="table-responsive">
                                <x-table class="table-bordered" headType="thead-light">
                                    <x-slot name="thead">
                                        <th>@lang('payroll::modules.payroll.earning')</th>
                                        <th class="text-right">@lang('app.amount')</th>
                                    </x-slot>

                                    <tr>
                                        <td>@lang('payroll::modules.payroll.basicPay')</td>
                                        <td class="text-right text-uppercase">
                                            {{ currency_format($basicSalary, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</td>
                                    </tr>
                                    @foreach ($earnings as $key => $item)
                                        @if($key == 'Time Logs')
                                            <tr>
                                                <td>{{ ($key) }}
                                                    @if(array_key_exists("Total Hours",$earnings))
                                                        ( @lang('payroll::modules.payroll.totalHours') {{$earnings['Total Hours']}} )
                                                    @endif</td>
                                                <td class="text-right">{{ currency_format($item, ($currency->currency ? $currency->currency->id : company()->currency->id ))  }}</td>
                                            </tr>
                                        @elseif($key != 'Total Hours')
                                        <tr>
                                            <td>{{ ($key) }}</td>
                                            <td class="text-right">{{ currency_format($item, ($currency->currency ? $currency->currency->id : company()->currency->id ))  }}</td>
                                        </tr>
                                        @endif
                                    @endforeach

                                    @forelse ($earningsExtra as $key=>$item)
                                        <tr>
                                            <td>{{ ($key) }}</td>
                                            <td class="text-right">{{ currency_format($item, ($currency->currency ? $currency->currency->id : company()->currency->id ))  }}</td>
                                        </tr>
                                    @endforeach


                                    <tr>
                                        <td>@lang('payroll::modules.payroll.fixedAllowance')</td>
                                        <td class="text-right text-uppercase">
                                            @php
                                                $fixedAllow = ($salarySlip->fixed_allowance > 0) ? $salarySlip->fixed_allowance : $fixedAllowance;
                                            @endphp
                                            {{ currency_format($fixedAllow, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</td>
                                    </tr>

                                    @forelse ($earningsAdditional as $key=>$item)
                                        <tr>
                                            <td>{{ ($key) }}</td>
                                            <td class="text-right">{{ currency_format($item, ($currency->currency ? $currency->currency->id : company()->currency->id ))  }}</td>
                                        </tr>
                                    @endforeach

                                </x-table>
                            </div>
                        </div>

                        <div class="col-md-6">

                            <div class="table-responsive">
                                <x-table class="table-bordered" headType="thead-light">
                                    <x-slot name="thead">
                                        <th>@lang('payroll::modules.payroll.deduction')</th>
                                        <th class="text-right">@lang('app.amount')</th>
                                    </x-slot>

                                    @foreach ($deductions as $key => $item)
                                        <tr>
                                            <td>{{ ($key) }}</td>
                                            <td class="text-right">{{ currency_format($item, ($currency->currency ? $currency->currency->id : company()->currency->id ) ) }}</td>
                                        </tr>
                                    @endforeach
                                    @foreach ($deductionsExtra as $key => $item)
                                        <tr>
                                            <td>{{ ($key) }}</td>
                                            <td class="text-right">{{ currency_format($item, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</td>
                                        </tr>
                                    @endforeach

                                </x-table>
                            </div>
                        </div>

                        <div class="col-md-3">
                            <h5 class="heading-h5 ml-3">@lang('payroll::modules.payroll.grossEarning')</h5>
                        </div>
                        <div class="col-md-3 text-right">
                            <h5 class="heading-h5">{{ currency_format($salarySlip->gross_salary, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h5>
                        </div>

                        <div class="col-md-3">
                            <h5 class="heading-h5">@lang('payroll::modules.payroll.totalDeductions')</h5>
                        </div>
                        @php
                            $allDeduction = array_sum($deductions) + array_sum($deductionsExtra);
                        @endphp
                        <div class="col-md-3 text-right">
                            <h5 class="heading-h5">{{ currency_format($allDeduction, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</h5>
                        </div>


                        <div class="col-md-12 mt-3">
                            <div class="table-responsive">
                                <x-table class="table-bordered" headType="thead-light">
                                    <x-slot name="thead">
                                        <th>@lang('payroll::modules.payroll.reimbursement')</th>
                                        <th class="text-right">@lang('app.amount')</th>
                                    </x-slot>

                                    <tr>
                                        <td>@lang('payroll::modules.payroll.expenseClaims')</td>
                                        <td class="text-right text-uppercase">
                                            {{ currency_format($salarySlip->expense_claims, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>@lang('app.total')
                                                @lang('payroll::modules.payroll.reimbursement')</strong></td>
                                        <td class="text-right">
                                            <strong>{{ currency_format($salarySlip->expense_claims, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</strong>
                                        </td>
                                    </tr>
                                </x-table>
                            </div>
                        </div>

                        <div class="col-md-12 p-20 mt-3">
                            <h3 class="text-center heading-h3">
                                <span class="text-uppercase mr-3">@lang('payroll::modules.payroll.netSalary'):</span>
                                {{ currency_format(sprintf('%0.2f', $salarySlip->net_salary), ($currency->currency ? $currency->currency->id : company()->currency->id )) }}
                            </h3>
                            <h5 class="text-center text-lightest">@lang('payroll::modules.payroll.netSalary') =
                                (@lang('payroll::modules.payroll.grossEarning') -
                                @lang('payroll::modules.payroll.totalDeductions') +
                                @lang('payroll::modules.payroll.reimbursement'))</h5>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<script>
    $('body').on('click', '.delete-payroll', function () {
        Swal.fire({
            title: "@lang('messages.sweetAlertTitle')",
            text: "@lang('messages.recoverRecord')",
            icon: 'warning',
            showCancelButton: true,
            focusConfirm: false,
            confirmButtonText: "@lang('messages.confirmDelete')",
            cancelButtonText: "@lang('app.cancel')",
            customClass: {
                confirmButton: 'btn btn-primary mr-3',
                cancelButton: 'btn btn-secondary'
            },
            showClass: {
                popup: 'swal2-noanimation',
                backdrop: 'swal2-noanimation'
            },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {
                var url = "{{ route('payroll.destroy', $salarySlip->id) }}";

                var token = "{{ csrf_token() }}";

                $.easyAjax({
                    type: 'POST',
                    url: url,
                    data: {
                        '_token': token,
                        '_method': 'DELETE'
                    },
                    success: function (response) {
                        if (response.status == "success") {
                            window.location.href = response.redirectUrl;
                        }
                    }
                });
            }
        });
    });
</script>
