<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    <div class="table-responsive">
        <x-table class="table-bordered">
            <x-slot name="thead">
                <th>@lang('payroll::modules.payroll.componentName')</th>
                <th>@lang('payroll::modules.payroll.componentType')</th>
                <th>@lang('payroll::modules.payroll.componentValue')</th>
                <th>@lang('payroll::modules.payroll.valueType')</th>
                <th class="text-right">@lang('app.action')</th>
            </x-slot>

            @forelse($salaryComponents as $key=>$salaryComponent)
                <tr id="type-{{ $salaryComponent->id }}">
                    <td> {{ $salaryComponent->component_name }}</td>
                    <td> {{ (__('payroll::modules.payroll.' . $salaryComponent->component_type)) }}</td>
                  @php  $rec =  __('app.monthly') .' - '. $salaryComponent->component_value ." <br> ";
                    $rec .=  __('app.weekly') .' - '. $salaryComponent->weekly_value ." <br> " ;
                    $rec .=  __('payroll::app.menu.biweekly') .' - '. $salaryComponent->biweekly_value ." <br> " ;
                    $rec .=  __('payroll::app.menu.semimonthly') .' - '. $salaryComponent->semimonthly_value ." <br> " ;
                @endphp
                    <td>
                        @if($salaryComponent->value_type == 'percent' || $salaryComponent->value_type == 'basic_percent')
                            {{$salaryComponent->component_value}}%
                        @else
                            {!! $rec !!}
                        @endif
                    </td>
                    <td> {{ (__('payroll::modules.payroll.' . $salaryComponent->value_type)) }}</td>
                    <td class="text-right">
                        <div class="task_view">
                            <a href="javascript:;" data-salary-components-id="{{ $salaryComponent->id }}"
                               class="edit-salary-component task_view_more d-flex align-items-center justify-content-center">
                                <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                            </a>
                        </div>
                        <div class="task_view">
                            <a href="javascript:;" data-salary-components-id="{{ $salaryComponent->id }}"
                               class="delete-salary-component task_view_more d-flex align-items-center justify-content-center">
                                <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')
                            </a>
                        </div>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="5">
                        <x-cards.no-record icon="list" :message="__('payroll::messages.noSalaryComponentsAdded')"/>
                    </td>
                </tr>
            @endforelse
        </x-table>
    </div>
</div>
