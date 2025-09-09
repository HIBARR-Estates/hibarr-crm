<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    <div class="table-responsive">
        <x-table class="table-bordered">
            <x-slot name="thead">
                <th>@lang('app.name')</th>
                <th>@lang('payroll::modules.payroll.salaryComponents')</th>
                <th class="text-right">@lang('app.action')</th>
            </x-slot>

            @forelse($salaryGroups as $key=>$salaryGroup)
                <tr id="type-{{ $salaryGroup->id }}">
                    <td> {{ $salaryGroup->group_name }} <br><small>@lang('app.employee')
                            : {{ $salaryGroup->employee_count }}</small></td>
                    <td>
                        <ul class="list-icons">
                            @foreach ($salaryGroup->components as $item)
                                <li>
                                    <i class="fa fa-chevron-right text-danger"></i> {{ $item->component?->component_name }}
                                </li>
                            @endforeach

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
                                    <a href="javascript:;" data-salary-group-id="{{ $salaryGroup->id }}"
                                       class="dropdown-item manage-employee">
                                        <i class="fa fa-user icons mr-2"></i> @lang('payroll::modules.payroll.manageEmployees')
                                    </a>
                                    <a href="javascript:;" data-salary-group-id="{{ $salaryGroup->id }}"
                                       class="dropdown-item edit-salary-group">
                                        <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                                    </a>
                                    <a href="javascript:;" data-salary-group-id="{{ $salaryGroup->id }}"
                                       class="dropdown-item delete-salary-group">
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
                        <x-cards.no-record icon="list" :message="__('payroll::messages.noSalaryGroupAdded')"/>
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
