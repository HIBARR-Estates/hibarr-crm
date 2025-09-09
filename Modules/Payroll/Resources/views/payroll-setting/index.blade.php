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
                            <a class="nav-item nav-link f-15 active salary-components"
                               href="{{ route('payroll.payroll_settings') }}" role="tab"
                               aria-controls="nav-salaryComponents" aria-selected="true"
                               ajax="false">@lang('payroll::app.menu.salaryComponents')
                            </a>
                            <a class="nav-item nav-link f-15 salary-groups"
                               href="{{ route('payroll.payroll_settings') }}?tab=salary-groups" role="tab"
                               aria-controls="nav-salaryGroups" aria-selected="true"
                               ajax="false">@lang('payroll::app.menu.salaryGroup')
                            </a>
                            <a class="nav-item nav-link f-15 salary-tds"
                               href="{{ route('payroll.payroll_settings') }}?tab=salary-tds" role="tab"
                               aria-controls="nav-salaryTds" aria-selected="true"
                               ajax="false">@lang('payroll::app.menu.salaryTds')
                            </a>
                            <a class="nav-item nav-link f-15 payment-methods"
                               href="{{ route('payroll.payroll_settings') }}?tab=payment-methods"
                               role="tab" aria-controls="nav-paymentMethods" aria-selected="true">
                                @lang('payroll::modules.payroll.salaryPaymentMethod')
                            </a>
                            <a class="nav-item nav-link f-15 salary-setting"
                               href="{{ route('payroll.payroll_settings') }}?tab=salary-setting"
                               role="tab" aria-controls="nav-paymentMethods" aria-selected="true">
                                @lang('payroll::modules.payroll.salarySlipData')
                            </a>
                            <a class="nav-item nav-link f-15 payroll-currency-setting"
                               href="{{ route('payroll.payroll_settings') }}?tab=payroll-currency-setting"
                               role="tab" aria-controls="nav-paymentMethods" aria-selected="true">
                                @lang('payroll::modules.payroll.payrollCurrencySetting')
                            </a>
                             
                        </div>
                    </nav>
                </div>
            </x-slot>

            <x-slot name="buttons">
                <div class="row">
                    <div class="col-md-12 mb-2">
                        <x-forms.button-primary icon="plus" id="addSalaryComponents"
                                                class="salary-components-btn mb-2 d-none actionBtn">
                            @lang('app.addNew') @lang('payroll::app.menu.salaryComponents')
                        </x-forms.button-primary>

                        <x-forms.button-primary icon="plus" id="addSalaryGroups"
                                                class="salary-groups-btn mb-2 d-none actionBtn">
                            @lang('app.addNew') @lang('payroll::app.menu.salaryGroup')
                        </x-forms.button-primary>

                        <x-forms.button-primary icon="plus" id="addSalaryTds"
                                                class="salary-tds-btn mb-2 d-none actionBtn mr-3">
                            @lang('app.addNew') @lang('payroll::app.menu.salaryTds')
                        </x-forms.button-primary>

                        <x-forms.button-secondary icon="plus" id="salaryTdsStatus"
                                                  class="salary-tds-btn mb-2 d-none actionBtn mr-3">
                            @lang('payroll::app.menu.salaryTds') @lang('app.status')
                        </x-forms.button-secondary>

                        <x-forms.button-primary icon="plus" id="addPaymentMethods"
                                                class="payment-methods-btn mb-2 d-none actionBtn">
                            @lang('app.addNew') @lang('payroll::modules.payroll.salaryPaymentMethod')
                        </x-forms.button-primary>


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

        showBtn(activeTab);

        function showBtn(activeTab) {
            $('.actionBtn').addClass('d-none');
            $('.' + activeTab + '-btn').removeClass('d-none');
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

        /* PAYMENT METHOD SCRIPTS */
        /* open add payment method modal */
        $('body').on('click', '#addPaymentMethods', function () {
            var url = "{{ route('payment-methods.create') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* open edit payment method modal */
        $('body').on('click', '.edit-payment-method', function () {
            var paymentMethodId = $(this).data('payment-method-id');
            var url = "{{ route('payment-methods.edit', ':id') }}";
            url = url.replace(':id', paymentMethodId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* delete payment method */
        $('body').on('click', '.delete-payment-method', function () {
            let obj = $(this).closest('tr');
            var id = $(this).data('payment-method-id');
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

                    var url = "{{ route('payment-methods.destroy', ':id') }}";
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
        /* PAYROLL PAYMENT METHOD SCRIPTS */

        $("body").on("click", ".employee-hourly-rate", function (event) {
            var url = "{{ route('payroll.payroll_settings') }}?tab=employee-hourly-rate";
            window.location.href = url;
        });


        /* SALARY COMPONENT SCRIPTS */
        /* open add salary component modal */
        $('body').on('click', '#addSalaryComponents', function () {
            var url = "{{ route('salary-components.create') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* open edit salary component modal */
        $('body').on('click', '.edit-salary-component', function () {
            var paymentMethodId = $(this).data('salary-components-id');
            var url = "{{ route('salary-components.edit', ':id ') }}";
            url = url.replace(':id', paymentMethodId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* delete salary component */
        $('body').on('click', '.delete-salary-component', function () {
            let obj = $(this).closest('tr');
            var id = $(this).data('salary-components-id');
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

                    var url = "{{ route('salary-components.destroy', ':id') }}";
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
        /* PAYROLL SALARY COMPONENT SCRIPTS */

        /* SALARY GROUP SCRIPTS */
        /* open add salary group modal */
        $('body').on('click', '#addSalaryGroups', function () {
            var url = "{{ route('salary-groups.create') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* open edit salary group modal */
        $('body').on('click', '.edit-salary-group', function () {
            var salaryGroupId = $(this).data('salary-group-id');
            var url = "{{ route('salary-groups.edit', ':id ') }}";
            url = url.replace(':id', salaryGroupId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* open manage employee in salary group modal */
        $('body').on('click', '.manage-employee', function () {
            var salaryGroupId = $(this).data('salary-group-id');
            var url = "{{ route('salary-groups.show', ':id ') }}";
            url = url.replace(':id', salaryGroupId);
            console.log(url);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* delete salary group */
        $('body').on('click', '.delete-salary-group', function () {
            let obj = $(this).closest('tr');
            var id = $(this).data('salary-group-id');
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

                    var url = "{{ route('salary-groups.destroy', ':id') }}";
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

        /* SALARY TDS SCRIPTS */
        /* open add salary tds modal */
        $('body').on('click', '#addSalaryTds', function () {
            var url = "{{ route('salary-tds.create') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* open salary tds status modal */
        $('body').on('click', '#salaryTdsStatus', function () {
            var url = "{{ route('salary_tds.get_status') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* open edit salary tds modal */
        $('body').on('click', '.edit-salary-tds', function () {
            var salaryTdsId = $(this).data('salary-tds-id');
            var url = "{{ route('salary-tds.edit', ':id ') }}";
            url = url.replace(':id', salaryTdsId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* delete salary tds */
        $('body').on('click', '.delete-salary-tds', function () {
            let obj = $(this).closest('tr');
            var id = $(this).data('salary-tds-id');
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

                    var url = "{{ route('salary-tds.destroy', ':id') }}";
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
        /* PAYROLL SALARY TDS SCRIPTS */


    </script>
@endpush
