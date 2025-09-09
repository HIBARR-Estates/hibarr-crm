<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('app.view') @lang('payroll::modules.payroll.salaryHistory')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">

    <p>
        <x-employee :user="$employee"/>
    </p>

    <div class="table-responsive">
        <x-table class="table-bordered" headType="thead-light">
            <x-slot name="thead">
                <th>#</th>
                <th>@lang('app.amount') (@lang('app.monthly'))</th>
                <th>@lang('payroll::modules.payroll.valueType')</th>
                <th>@lang('app.date')</th>
                <th class="text-right">@lang('app.action')</th>
            </x-slot>

            @forelse($salaryHistory as $key=>$salary)
                <tr>
                    <td>{{ $key + 1 }}</td>
                    <td>
                        @if ($salary->type == 'initial')
                            {{ currency_format($salary->amount, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}
                        @elseif($salary->type == 'increment')
                            <span
                                class="text-success">+{{ currency_format($salary->amount, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</span>
                        @elseif($salary->type == 'decrement')
                            <span
                                class="text-danger">-{{ currency_format($salary->amount, ($currency->currency ? $currency->currency->id : company()->currency->id )) }}</span>
                        @endif
                    </td>
                    <td>
                        {{ $salary->type }}
                    </td>
                    <td>
                        {{ $salary->date->format($company->date_format) }}
                    </td>
                    <td class="text-right">
                        @if ($salary->type == 'increment' || $salary->type == 'decrement')
                            <div class="task_view">
                                <a class="edit-salary task_view_more d-flex align-items-center justify-content-center"
                                href="javascript:;" data-salary-id="{{ $salary->id }}">
                                    <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                                </a>
                            </div>
                        @endif
                        <div class="task_view">
                            <a class="delete-salary task_view_more d-flex align-items-center justify-content-center"
                               href="javascript:;" data-salary-id="{{ $salary->id }}">
                                <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')
                            </a>
                        </div>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="5">
                        <x-cards.no-record icon="dollar-sign" :message="__('messages.noRecordFound')"/>
                    </td>
                </tr>
            @endforelse
            <tr>
                <th>@lang('app.total')</th>
                <th>
                    {{ currency_format($employeeSalary['netSalary'],  ($currency->currency ? $currency->currency->id : company()->currency->id )) }}
                </th>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
            </tr>
        </x-table>
    </div>

</div>
<script>
    /* edit salary */
    $('body').off('click', ".edit-salary").on('click', '.edit-salary', function () {
        const salaryId = $(this).data('salary-id');
        const url = "{{ route('employee-salary.increment_edit') }}?salaryId=" + salaryId;

        $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
        $.ajaxModal(MODAL_LG, url);
    });

    /* delete salary */
    $('body').on('click', '.delete-salary', function () {
        var id = $(this).data('salary-id');
        Swal.fire({
            title: "@lang('messages.sweetAlertTitle')",
            text: "@lang('payroll::messages.salaryDelete')",
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

                var url = "{{ route('employee-salary.destroy', ':id') }}";
                url = url.replace(':id', id);

                var token = "{{ csrf_token() }}";

                $.easyAjax({
                    type: 'POST',
                    url: url,
                    blockUI: true,
                    data: {
                        '_token': token,
                        '_method': 'DELETE'
                    },
                    success: function (response) {
                        if (response.status == "success") {
                            window.location.reload();
                        }
                    }
                });
            }
        });
    });
</script>
