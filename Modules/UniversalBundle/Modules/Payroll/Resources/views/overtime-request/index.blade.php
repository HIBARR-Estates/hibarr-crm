@extends('layouts.app')

@push('datatable-styles')
    @include('sections.datatable_css')
@endpush

@section('filter-section')
<x-filters.filter-box>

    <!-- DESIGNATION START -->
    <div class="select-box d-flex py-2 pr-lg-3 pr-md-3 px-0 border-right-grey border-right-grey-sm-0">
        <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center"> @lang('app.designation')</p>
        <div class="select-status">
            <select class="form-control select-picker" name="designation" id="designation" data-live-search="true">
                <option value="all">@lang('app.all')</option>
                @foreach ($departments as $department)
                <option value="{{ $department->id }}">{{ ($department->team_name) }}</option>
            @endforeach
            </select>
        </div>
    </div>
    <!-- DESIGNATION END -->
    <div class="select-box d-flex py-2 px-lg-3 px-md-3 px-0 border-right-grey border-right-grey-sm-0">
        <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center"> @lang('app.department')</p>
        <div class="select-status">
            <select class="form-control select-picker" name="department" id="department" data-live-search="true">
                <option value="all">@lang('app.all')</option>
                @foreach ($departments as $department)
                        <option value="{{ $department->id }}">{{ ($department->team_name) }}</option>
                    @endforeach
            </select>
        </div>
    </div>

    <div class="select-box d-flex py-2 px-lg-3 px-md-3 px-0 border-right-grey border-right-grey-sm-0">
        <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center"
           id="select-label">@lang('payroll::app.employee')</p>
        <div class="select-status">
            <select class="form-control select-picker" name="employee_id"  id="selectEmployee" data-live-search="true">
            <option value="all">@lang('app.all')</option>
                @foreach ($employees as $item)
                <x-user-option :user="$item" :pill="true" />
            @endforeach
            </select>
        </div>
    </div>
    <div class="select-box d-flex py-2 pr-lg-3 pr-md-3 px-0 border-right-grey border-right-grey-sm-0">
        <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.select') @lang('app.year')</p>
        <div class="select-status">
            <select class="form-control select-picker" name="year" id="year">
                @for($i = $year; $i >= ($year-4); $i--)
                    <option @if($i == $year) selected @endif value="{{ $i }}">{{ $i }}</option>
                @endfor
            </select>
        </div>
    </div>

    <div class="select-box d-flex py-2 px-lg-3 px-md-3 px-0 border-right-grey border-right-grey-sm-0">
        <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center"
           id="select-label">@lang('app.select') @lang('app.month')</p>
        <div class="select-status">
            <select class="form-control select-picker" name="month" id="month" data-live-search="true">
                @foreach($months as $key => $monthName)
                    <option value="{{ ($key + 1)}}" @if($month == ($key + 1)) selected @endif> {{ __('app.months.'.ucfirst($monthName) )}}</option>
                @endforeach
            </select>
        </div>
    </div>

    <!-- SEARCH BY TASK END -->

    <!-- RESET START -->
    <div class="select-box d-flex py-1 px-lg-2 px-md-2 px-0">
        <x-forms.button-secondary class="btn-xs d-none" id="reset-filters" icon="times-circle">
            @lang('app.clearFilters')
        </x-forms.button-secondary>
    </div>
    <!-- RESET END -->

</x-filters.filter-box>


@endsection

@section('content')
    <!-- CONTENT WRAPPER START -->
    <div class="content-wrapper">
        <!-- Add Task Export Buttons Start -->

        <div class="row">
            <div class="col-md-6 mb-3">
                <div
                    class="bg-white p-20 rounded b-shadow-4 d-flex justify-content-between align-items-center mt-3 mt-lg-0 mt-md-0">
                    <div class="d-block ">
                        <h5 class="f-15 f-w-500 mb-20 text-darkest-grey"> @lang('payroll::modules.payroll.approvedStatus') </h5>
                        <div class="d-flex">
                            <p class="mb-0 f-21 font-weight-bold text-blue d-grid mr-5">
                                <span id="requested">0</span>
                                <span class="f-12 font-weight-normal text-lightest">@lang('payroll::modules.payroll.requested')</span>
                            </p>

                            <p class="mb-0 f-21 font-weight-bold text-success d-grid mr-5">
                                <span id="approved">0</span>
                                <span class="f-12 font-weight-normal text-lightest">@lang('app.approved')</span>
                            </p>

                            <p class="mb-0 f-21 font-weight-bold text-danger d-grid mr-5">
                                <span id="rejected">0</span>
                                <span class="f-12 font-weight-normal text-lightest">@lang('app.rejected')</span>
                            </p>
                            <p class="mb-0 f-21 font-weight-bold text-warning d-grid mr-5">
                                <span id="pending">0</span>
                                <span class="f-12 font-weight-normal text-lightest">@lang('app.pending')</span>
                            </p>
                        </div>
                    </div>
                    <div class="d-block">
                        <i class="fa fa-thumbs-up text-lightest f-27"></i>
                    </div>
                </div>
            </div>
            <div class="col-md-6 mb-3">
                <div
                    class="bg-white p-20 rounded b-shadow-4 d-flex justify-content-between align-items-center mt-3 mt-lg-0 mt-md-0">
                    <div class="d-block ">
                        <h5 class="f-15 f-w-500 mb-20 text-darkest-grey"> @lang('payroll::modules.payroll.overtimeHoursSummery') </h5>
                        <div class="d-flex">
                            <p class="mb-0 f-21 font-weight-bold  d-grid mr-5">
                                <span id="overtimeHours">0</span>
                                <span class="f-12 font-weight-normal text-lightest">@lang('payroll::modules.payroll.overtimeHours')</span>
                            </p>

                            <p class="mb-0 f-21 font-weight-bold d-grid mr-5">
                                <span id="compensation">0</span>
                                <span class="f-12 font-weight-normal text-lightest">@lang('payroll::modules.payroll.compensation')</span>
                            </p>

                        </div>
                    </div>
                    <div class="d-block">
                        <i class="fa fa-hourglass text-lightest f-27"></i>
                    </div>
                </div>
            </div>
        </div>

        <div class="d-flex" id="table-actions">

            @if(($userData->employeeDetail->overtime_hourly_rate > 0 && !is_null($userPolicy)) || $userData->hasRole('admin'))

                <x-forms.link-primary link="javascript:;" class="mr-3 float-left mb-2 mb-lg-0 mb-md-0 add-request"
                icon="plus">
                    @lang('payroll::modules.payroll.addRequest')
                </x-forms.link-primary>
            @endif
        </div>
        <!-- Add Task Export Buttons End -->
        <!-- Task Box Start -->
        <div class="d-flex flex-column w-tables rounded mt-3 bg-white">

            {!! $dataTable->table(['class' => 'table table-hover border-0 w-100']) !!}

        </div>
        <!-- Task Box End -->
    </div>
    <!-- CONTENT WRAPPER END -->

@endsection

@push('scripts')
    @include('sections.datatable_js')

    <script>
        getOvertimeData();

        $('#overtime-request').on('preXhr.dt', function (e, settings, data) {

            const designation = $('#designation').val();
            const department = $('#department').val();
            const year = $('#year').val();
            const month = $('#month').val();
            const employee = $('#selectEmployee').val();
            data['designation'] = designation;
            data['department'] = department;
            data['year'] = year;
            data['month'] = month;
            data['employee'] = employee;
        });

        const showTable = () => {
            window.LaravelDataTables["overtime-request"].draw(false);
            getOvertimeData();
        }

        function getOvertimeData() {

            const designation = $('#designation').val();
            const department = $('#department').val();
            const year = $('#year').val();
            const month = $('#month').val();
            const employee = $('#selectEmployee').val();

            var url = "{{ route('overtime-request-data') }}?designation="+designation+"&department="+department+"&year="+year+"&month="+month+"&employee="+employee;

            $.easyAjax({
                type: 'GET',
                url: url,
                success: function (response) {
                    console.log(response.overtimeData);
                    $('#requested').html(response.overtimeData.requested);
                    $('#approved').html(response.overtimeData.approved);
                    $('#rejected').html(response.overtimeData.rejected);
                    $('#pending').html(response.overtimeData.pending);
                    $('#overtimeHours').html(response.overtimeData.overtimeHours);
                    $('#compensation').html(response.overtimeData.compensation);
                }
            });
        }

        $('#designation, #department, #selectEmployee, #year, #month').on('change keyup',
            function () {
                if ($('#designation').val() !== "all") {
                    $('#reset-filters').removeClass('d-none');
                } else if ($('#department').val() !== "all") {
                    $('#reset-filters').removeClass('d-none');
                } else if ($('#search-text-field').val() != "") {
                    $('#reset-filters').removeClass('d-none');
                } else {
                    $('#reset-filters').addClass('d-none');
                }

                showTable();
            });

        $('#reset-filters').click(function () {
            $('#filter-form')[0].reset();
            $('.filter-box .select-picker').selectpicker("refresh");
            $('#reset-filters').addClass('d-none');
            showTable();
        });

        $('body').on('click', '.add-request', function () {
            let url = '{{ route("overtime-requests.create")}}';
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });


        $('body').on('click', '.editRequest', function () {
            const requestId = $(this).data('request-id');
            let url = '{{ route("overtime-requests.edit", ":id")}}';
            url = url.replace(':id', requestId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('body').on('click', '.showRequest', function () {
            const requestId = $(this).data('request-id');
            let url = '{{ route("overtime-requests.show", ":id")}}';
            url = url.replace(':id', requestId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

         /* delete overtime request */
         $('#overtime-request').on('click', '.delete-request-table-row', function () {
            let obj = $(this).closest('tr');
            var id = $(this).data('request-id');
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

                    var url = "{{ route('overtime-requests.destroy', ':id') }}";
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
                                obj.remove();
                                showTable();
                            }
                        }
                    });
                }
            });
        });
        /* PAYROLL SALARY SCRIPTS */



        /* delete overtime request */
         $('#overtime-request').on('click', '.acceptButton', function () {
            var id = $(this).data('request-id');
            var type = $(this).data('type');

            var butonText = "@lang('payroll::messages.confirmAccept')";
            if(type != 'accept'){
                butonText = "@lang('payroll::messages.confirmReject')";
            }
            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('payroll::messages.recoverRecord')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: butonText,
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

                    var url = "{{ route('overtime-request-accept', ':id') }}?type="+type;
                    url = url.replace(':id', id);

                    $.easyAjax({
                        type: 'GET',
                        url: url,
                        blockUI: true,
                        success: function (response) {
                            if (response.status == "success") {
                                showTable();
                            }
                        }
                    });
                }
            });
        });
        /* PAYROLL SALARY SCRIPTS */

        $('#overtime-request').on('change', '.change-status', function (e) {
            e.preventDefault();
            const id = $(this).data('request-id');
            const status = $(this).val();
            const token = "{{ csrf_token() }}";
            if (id !== undefined && id != '') {
                $.easyAjax({
                    url: '{{route("overtime-change-status")}}',
                    type: "POST",
                    data: {request_id: id, status: status, _token: token},
                    success: function (response) {
                        if (response.status === "success") {
                            showTable();
                        }
                    }
                })
            }
        });

    </script>
@endpush
