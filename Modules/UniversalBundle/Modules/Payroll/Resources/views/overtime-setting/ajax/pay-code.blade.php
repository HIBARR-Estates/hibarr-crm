<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    <div class="table-responsive">
        <x-table class="table-bordered">
            <x-slot name="thead">
                <th>@lang('app.code')</th>
                <th>@lang('app.name')</th>
                <th>@lang('payroll::modules.payroll.type')</th>
                <th class="text-right">@lang('app.action')</th>
            </x-slot>

            @forelse($payCodes as $key=>$payCode)
                <tr id="type-{{ $payCode->id }}">
                    <td> <b> {{ $payCode->code }} </b> </td>

                    <td> {{ $payCode->name }} </td>
                    <td>
                        @if($payCode->fixed == 1)
                            {{ $payCode->fixed_amount }}
                            <label class='badge badge-primary'>@lang('payroll::modules.payroll.fixed')</label>
                        @else
                            <label class='badge badge-warning'>{{ $payCode->time }} X @lang('payroll::modules.payroll.hourlyRate', [ 'currency' => $payrollSetting->currency->currency_symbol ?? company()->currency->currency_symbol])</label>
                        @endif
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
                                    <a href="javascript:;" data-pay-code-id="{{$payCode->id}}"
                                       class="dropdown-item edit-pay-code">
                                        <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                                    </a>
                                    <a href="javascript:;" data-pay-code-id="{{$payCode->id}}"
                                       class="dropdown-item delete-pay-code">
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
                        <x-cards.no-record icon="list" :message="__('payroll::messages.noPayCodeAdded')"/>
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
