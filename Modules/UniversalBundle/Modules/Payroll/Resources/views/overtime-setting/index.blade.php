@extends('layouts.app')

@section('content')

    <!-- SETTINGS START -->
    <div class="w-100 d-flex ">
        <x-setting-sidebar :activeMenu="$activeSettingMenu"/>

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <nav class="tabs px-4 border-bottom-grey">
                        <div class="nav" id="nav-tab" role="tablist">

                            <a class="nav-item nav-link f-15 active pay-code"
                               href="{{ route('payroll.overtime_settings') }}?tab=pay-code" role="tab"
                               aria-controls="nav-salaryGroups" aria-selected="true"
                               ajax="false">@lang('payroll::app.menu.payCode')
                            </a>
                            <a class="nav-item nav-link f-15  overtime-policy"
                                href="{{ route('payroll.overtime_settings') }}?tab=overtime-policy" role="tab"
                                aria-controls="nav-salaryComponents" aria-selected="true"
                                ajax="false">@lang('payroll::app.menu.overtimePolicy')
                            </a>
                            <a class="nav-item nav-link f-15 overtime-policy-employee"
                               href="{{ route('payroll.overtime_settings') }}?tab=overtime-policy-employee" role="tab"
                               aria-controls="nav-salaryTds" aria-selected="true"
                               ajax="false">@lang('payroll::app.menu.overtimePolicyEmployee')
                            </a>
                            <a class="nav-item nav-link f-15 employee-hourly-rate"
                               href="{{ route('payroll.overtime_settings') }}?tab=employee-hourly-rate"
                               role="tab" aria-controls="nav-paymentMethods" aria-selected="true" ajax="false">
                                @lang('payroll::modules.payroll.employeeHourlyRate')
                            </a>

                        </div>
                    </nav>
                </div>

            </x-slot>


            <x-slot name="buttons">

                <div class="row">
                    <div class="col-md-12 mb-2">
                        <x-forms.button-primary icon="plus" id="addPolicy"
                                                class="overtime-policy-btn mb-2 d-none actionBtn">
                            @lang('app.addNew') @lang('payroll::app.menu.overtimePolicy')
                        </x-forms.button-primary>

                        <x-forms.button-primary icon="plus" id="payCode"
                                                class="pay-code-btn mb-2 d-none actionBtn">
                            @lang('app.addNew') @lang('payroll::app.menu.payCode')
                        </x-forms.button-primary>

                        <x-forms.button-primary icon="plus" id="overtimeRequest"
                                                class="overtime-request-btn mb-2 d-none actionBtn mr-3">
                            @lang('app.addNew') @lang('payroll::app.menu.overtimeRequest')
                        </x-forms.button-primary>
                    </div>
                </div>

                <div class="row pay-code-info" id="payCodeInfo">
                    <div class="col-md-12">
                        <x-alert type="info" icon="info-circle">
                            @lang('payroll::messages.payCodeForOvertimePolicy')
                        </x-alert>
                    </div>
                </div>
            </x-slot>


            {{-- include tabs here --}}
            @include($view)

        </x-setting-card>

    </div>
    <!-- SETTINGS END -->

@endsection

@push('scripts')
    <script>
        /* MENU SCRIPTS */
        /* manage menu active class */
        $('.nav-item').removeClass('active');
        const activeTab = "{{ $activeTab }}";
        $('.' + activeTab).addClass('active');

        if(activeTab == 'pay-code'){
            $('#payCodeInfo').removeClass('d-none');
        }
        else{
            $('#payCodeInfo').addClass('d-none');
        }

        showBtn(activeTab);

        function showBtn(activeTab) {
            $('.actionBtn').addClass('d-none');
            $('.' + activeTab + '-btn').removeClass('d-none');

            if(activeTab == 'pay-code'){
                $('#payCodeInfo').removeClass('d-none');
            }
            else{
                $('#payCodeInfo').addClass('d-none');
            }
        }

        $("body").on("click", ".nav a", function (event) {
            event.preventDefault();

            $('.nav-item').removeClass('active');
            $(this).addClass('active');

            const requestUrl = this.href;

            $.easyAjax({
                url: requestUrl,
                blockUI: true,
                container: "#nav-tabContent",
                historyPush: true,
                success: function (response) {
                    if (response.status == "success") {
                        showBtn(response.activeTab);
                        $('#nav-tabContent').html(response.html);
                        init('#nav-tabContent');
                    }
                }
            });
        });
        /* MENU SCRIPTS END */

        $("body").on("click", ".overtime-policy-employee", function (event) {
            var url = "{{ route('payroll.overtime_settings') }}?tab=overtime-policy-employee";
            window.location.href = url;
        });

        $("body").on("click", ".employee-hourly-rate", function (event) {
            var url = "{{ route('payroll.overtime_settings') }}?tab=employee-hourly-rate";
            window.location.href = url;
        });

        /* open add policy method modal */
        $('body').on('click', '#addPolicy', function () {
            var url = "{{ route('overtime-policies.create') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('body').on('click', '#payCode', function () {
            var url = "{{ route('pay-codes.create') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

         /* open edit pay code modal */
         $('body').on('click', '.edit-pay-code', function () {
            var payCodeId = $(this).data('pay-code-id');
            var url = "{{ route('pay-codes.edit', ':id') }}";
            url = url.replace(':id', payCodeId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* open edit overtime policy modal */
         $('body').on('click', '.edit-policy', function () {
            var policyId = $(this).data('policy-id');
            var url = "{{ route('overtime-policies.edit', ':id') }}";
            url = url.replace(':id', policyId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* delete pay code */
        $('body').on('click', '.delete-pay-code', function () {
            let obj = $(this).closest('tr');
            var id = $(this).data('pay-code-id');
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

                    var url = "{{ route('pay-codes.destroy', ':id') }}";
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
                            }
                        }
                    });
                }
            });
        });
        /* PAYROLL SALARY GROUP SCRIPTS */

        /* delete overtime Policy */
        $('body').on('click', '.delete-policy', function () {
            let obj = $(this).closest('tr');
            var id = $(this).data('policy-id');
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

                    var url = "{{ route('overtime-policies.destroy', ':id') }}";
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
                            }
                        }
                    });
                }
            });
        });
        /* PAYROLL SALARY GROUP SCRIPTS */

    </script>
@endpush
