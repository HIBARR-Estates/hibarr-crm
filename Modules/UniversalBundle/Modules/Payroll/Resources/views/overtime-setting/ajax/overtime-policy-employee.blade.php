@include('sections.datatable_css')
<style>
    #employee_hourly_rate_wrapper .bg-additional-grey {
        background-color: #ffffff;
    }
</style>

<div class="w-100 pl-4">
    <div class="d-flex justify-content-between row">
        <form action="" class="flex-grow-1 " id="filter-form">
            <div class="d-flex col-md-12">
                <div class="px-0 py-2 mr-3 select-box">
                    <x-forms.select fieldId="user_id" :fieldLabel="__('app.employee')"
                    fieldName="user_id" :search="true">
                    <option value="all">@lang('app.all')</option>
                    @foreach ($employees as $employee)
                        <x-user-option :user="$employee" />
                    @endforeach
                    </x-forms.select>
                </div>
                <div class="px-0 py-2 mr-3 select-box px-lg-2 px-md-2">
                    <x-forms.label fieldId="status" />
                    <div class="rounded input-group bg-grey mt-3">
                        <div class="input-group-prepend">
                            <span class="input-group-text bg-additional-grey">
                                <i class="fa fa-search f-13 text-dark-grey"></i>
                            </span>
                        </div>
                        <input type="text" class="p-1 border form-control f-14 height-35" id="search-text-field"
                            placeholder="@lang('app.startTyping')">
                    </div>
                </div>
            </div>


        </form>

    </div>
</div>


<div class="col-md-12  w-100 pl-4" id="taxDatatable">
    <div class="d-flex mt-4 justify-content-end action-bar">

        <x-datatable.actions>
            <div class="select-status mr-3">
                <select name="action_type" class="form-control select-picker" id="quick-action-policy" disabled>
                    <option value="">@lang('payroll::modules.payroll.selectPolicy')</option>
                        @foreach($overtimePolicies as $overtimePolicy)
                            <option value="{{ $overtimePolicy->id }}"> {{ $overtimePolicy->name }}</option>
                        @endforeach
                </select>
            </div>
        </x-datatable.actions>
    </div>
    <div class="mt-3 bg-white rounded d-flex flex-column w-tables mb-3">
        <input type="hidden" name="_method" value="POST">
        {!! $dataTable->table(['class' => 'table table-hover border-0 w-100']) !!}
    </div>


</div>

@include('sections.datatable_js')

    <script type="text/javascript">

    $('#overtime-policy-employee').on('preXhr.dt', function(e, settings, data) {
        var searchText = $('#search-text-field').val();
        var user_id = $('#user_id').val();
        data['searchText'] = searchText;
        data['user_id'] = user_id;
    });

    const showTable = () => {
        window.LaravelDataTables["overtime-policy-employee"].draw(false);
    }

    // On Tax Type Change
    $('#user_id').on('change', function() {
        showTable();
    });

    // On search field keyup
    $('#search-text-field').on('keyup', function() {
        if ($('#search-text-field').val() != "") {
            $('#reset-filters').removeClass('d-none');
            showTable();
        }
    });

    $('#quick-action-policy').change(function () {
        const actionValue = $(this).val();
        quickAction(actionValue);
    });

    function quickAction(actionValue){
        if (actionValue != '') {
            $('#quick-action-apply').removeAttr('disabled');

            if (actionValue == 'change-status') {
                $('.quick-action-field').addClass('d-none');
                $('#change-status-action').removeClass('d-none');
            } else {
                $('.quick-action-field').addClass('d-none');
            }
        } else {
            $('#quick-action-apply').attr('disabled', true);
            $('.quick-action-field').addClass('d-none');
        }
    }

    $('#quick-action-apply').click(function (e) {
            e.preventDefault();
            var id = $('#quick-action-policy').val();
            if(id != '' && id != undefined)
            {
                Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('payroll::messages.policyConfirm')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: "@lang('payroll::messages.confirmChangePolicy')",
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

                        var rowdIds = $("#overtime-policy-employee input:checkbox:checked").map(function() {
                            return $(this).val();
                        }).get();
                        var token = "{{ csrf_token() }}";
                        $.easyAjax({
                            url: "{{ route('overtime-policies.employee-quick-action') }}",
                            container: '#addOvertimePolicy',
                            type: "POST",
                            blockUI: true,
                            disableButton: true,
                            buttonSelector: "#savePolicy",
                            data: {'_token':token, 'employeeIds': rowdIds, 'policyId': id},
                            success: function (response) {
                                window.location.reload();
                            }
                        })
                    }
                });
            }

        });

        $('body').on('click', '.removePolicy', function (e) {
            e.preventDefault();
            var id = $(this).data('user-id');
            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('payroll::messages.policyRemoveConfirm')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: "@lang('payroll::messages.confirmRemovePolicy')",
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
                    var url = "{{ route('overtime-policy-remove', ':id') }}";
                    url = url.replace(':id', id);
                    var token = "{{ csrf_token() }}";
                    $.easyAjax({
                        url: url,
                        container: '#addOvertimePolicy',
                        type: "GET",
                        blockUI: true,
                        disableButton: true,
                        success: function (response) {
                            showTable();
                        }
                    })
                }
            });
        });

        /* PAYROLL SALARY GROUP SCRIPTS */

    </script>
