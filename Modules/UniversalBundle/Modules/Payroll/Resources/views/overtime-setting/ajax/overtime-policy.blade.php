<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    <div class="table-responsive">
        <x-table class="table-bordered">
            <x-slot name="thead">
                <th>@lang('app.name')</th>
                <th>@lang('payroll::app.menu.payCode')</th>
                <th>@lang('payroll::modules.payroll.allows')</th>
                <th class="text-right">@lang('app.action')</th>
            </x-slot>

            @forelse($overtimePolicies as $key=>$overtimePolicy)
                <tr id="type-{{ $overtimePolicy->id }}">
                    <td> {{ $overtimePolicy->name }} </td>
                    <td>
                        {{ $overtimePolicy->payCode->name }} ({{$overtimePolicy->payCode->code}})
                        <br>
                        @if($overtimePolicy->payCode->fixed == 1)
                            {{ $overtimePolicy->payCode->fixed_amount }}
                            <label class='badge badge-primary'>@lang('payroll::modules.payroll.fixed')</label>
                        @else

                            <label class='badge badge-warning'>{{ $overtimePolicy->payCode->time }} X @lang('payroll::modules.payroll.hourlyRate', [ 'currency' => ($payrollSetting->currency) ? $payrollSetting->currency->currency_symbol : company()->currency->currency_symbol])</label>
                        @endif
                    </td>
                    <td>
                        <ul>
                            <li>
                                <i data-toggle="tooltip" data-original-title="@lang('app.allow')" class="fa @if($overtimePolicy->working_days == 1)fa-check text-success @else fa-times text-danger @endif "></i> @lang('payroll::modules.payroll.workingDays')
                            </li>
                            <li>
                                <i data-toggle="tooltip" data-original-title="@lang('app.allow')" class="fa @if($overtimePolicy->week_end == 1)fa-check text-success @else fa-times text-danger @endif "></i> @lang('payroll::modules.payroll.weekEnds')
                            </li>
                            <li>
                                <i data-toggle="tooltip" data-original-title="@lang('app.allow')" class="fa @if($overtimePolicy->holiday == 1)fa-check text-success @else fa-times text-danger @endif "></i> @lang('payroll::modules.payroll.holiday')
                            </li>
                        </ul>
                    </td>
                    <td class="text-right">
                        <div class="task_view">
                            <div class="dropdown">
                                <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle"
                                   type="link" id="dropdownMenuLink-3" data-toggle="dropdown"
                                   aria-haspopup="true" aria-expanded="false">
                                    <i class="icon-options-vertical icons"></i>
                                </a>
                                <div class="dropdown-menu dropdown-menu-right">

                                    <a href="javascript:;" data-policy-id="{{ $overtimePolicy->id }}"
                                       class="dropdown-item edit-policy">
                                        <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                                    </a>
                                    <a href="javascript:;" data-policy-id="{{ $overtimePolicy->id }}"
                                       class="dropdown-item delete-policy">
                                        <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')
                                    </a>
                                </div>
                            </div>
                        </div>

                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="4">
                        <x-cards.no-record icon="list" :message="__('payroll::messages.noOvertimePolicyFound')"/>
                    </td>
                </tr>
            @endforelse
        </x-table>
    </div>
</div>

<script>

    $('.table-responsive').on('show.bs.dropdown', function () {
        $('.table-responsive').css("overflow", "inherit");
    });

    $('.table-responsive').on('hide.bs.dropdown', function () {
        $('.table-responsive').css("overflow", "auto");
    })

</script>
