@extends('layouts.app')

@section('content')

    <!-- SETTINGS START -->
    <div class="w-100 d-flex">

        <x-setting-sidebar :activeMenu="$activeSettingMenu" />

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <nav class="tabs px-4 border-bottom-grey">
                        <div class="nav" id="nav-tab" role="tablist">
                            <a class="nav-item nav-link f-15 active goal-type-settings"
                                href="{{ route('performance-settings.index') }}" role="tab" aria-controls="nav-goalTypeSettings"
                                aria-selected="true">@lang('performance::app.goalTypeSettings')
                            </a>
                            <a class="nav-item nav-link f-15 key-results-metrics"
                                href="{{ route('performance-settings.index') }}?tab=key-results-metrics" role="tab"
                                aria-controls="nav-keyResultsMetrics" aria-selected="true"
                                ajax="false">@lang('performance::app.keyResultsMetrics')
                            </a>
                            <a class="nav-item nav-link f-15 notification-settings"
                                href="{{ route('performance-settings.index') }}?tab=notification-settings" role="tab"
                                aria-controls="nav-keyResultsMetrics" aria-selected="true"
                                ajax="false">@lang('performance::app.notificationSettings')
                            </a>
                            <a class="nav-item nav-link f-15 meeting-settings"
                                href="{{ route('performance-settings.index') }}?tab=meeting-settings" role="tab"
                                aria-controls="nav-keyResultsMetrics" aria-selected="true"
                                ajax="false">@lang('performance::app.meetingSettings')
                            </a>
                        </div>
                    </nav>
                </div>
            </x-slot>

            <x-slot name="buttons">
                <div class="row">
                    <div class="col-md-12 mb-2">
                        <x-forms.button-primary icon="plus" id="keyResultsMetrics"
                                class="key-results-metrics-btn mb-2 d-none actionBtn">
                            @lang('app.add') @lang('performance::app.keyResultsMetrics')
                        </x-forms.button-primary>
                    </div>
                </div>
            </x-slot>

            <!-- include tabs here -->
            @include($view)

        </x-setting-card>
    </div>
    <!-- SETTINGS END -->
@endsection

@push('scripts')
    <script>
        /* manage menu active class */
        $('.nav-item').removeClass('active');
        const activeTab = "{{ $activeTab }}";
        $('.' + activeTab).addClass('active');

        $("body").on("click", "#editSettings .nav a", function(event) {
            event.preventDefault();

            $('.nav-item').removeClass('active');
            $(this).addClass('active');

            const requestUrl = this.href;

            $.easyAjax({
                url: requestUrl,
                blockUI: true,
                container: "#nav-tabContent",
                historyPush: true,
                success: function(response) {
                    if (response.status == "success") {
                        showBtn(response.activeTab);
                        $('#nav-tabContent').html(response.html);
                        init('#nav-tabContent');
                    }
                }
            });
        });

        function showBtn(activeTab) {
            $('.actionBtn').addClass('d-none');
            $('.' + activeTab + '-btn').removeClass('d-none');
        }

        showBtn(activeTab);

        /* key results */
        $('body').on('click', '.edit-goal-type', function () {
            var paymentMethodId = $(this).data('goal-type-id');
            var url = "{{ route('goal-type-settings.edit', ':id') }}";
            url = url.replace(':id', paymentMethodId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        /* key results */
        $('body').on('click', '#keyResultsMetrics', function () {
            let url = "{{ route('key-results-metrics.create') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('body').on('click', '.edit-key-results', function () {
            var paymentMethodId = $(this).data('metrics-type-id');
            var url = "{{ route('key-results-metrics.edit', ':id') }}";
            url = url.replace(':id', paymentMethodId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('body').on('click', '.delete-key-results', function () {
            let obj = $(this).closest('tr');
            var id = $(this).data('metrics-type-id');
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

                    var url = "{{ route('key-results-metrics.destroy', ':id') }}";
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

        /* Notification setting */
        $('body').on('change', '.change-notification-setting', function() {

            let token = '{{ csrf_token() }}';
            let id = $(this).data('setting-id');
            let type = $(this).data('setting-type');
            let status = $(this).is(':checked') ? 'yes' : 'no';

            var url = "{{ route('performance-settings.update', ':id') }}";
            url = url.replace(':id', id);

            $.easyAjax({
                type: 'PUT',
                url: url,
                container: '.settings-box',
                blockUI: true,
                data: {
                    '_token': token,
                    'status': status,
                    'type': type,
                }
            });
        });

        /* Meeting setting */
        $(".multiple-option").selectpicker({
            actionsBox: true,
            selectAllText: "{{ __('modules.permission.selectAll') }}",
            deselectAllText: "{{ __('modules.permission.deselectAll') }}",
            multipleSeparator: ", ",
            selectedTextFormat: "count > 8",
            countSelectedText: function(selected, total) {
                return selected + " {{ __('app.membersSelected') }} ";
            }
        });

        $('body').on('click', '#save-meeting-form', function(event) {
            event.preventDefault();
            const id = $(this).data('setting-id');
            let url = "{{ route('performance-settings.meeting-setting', ':id') }}";
            url = url.replace(':id', id);

            $.easyAjax({
                url: url,
                type: "POST",
                redirect: true,
                disableButton: true,
                blockUI: true,
                container: '#editSettings',
                data: $('#editSettings').serialize(),
                success: function(response) {
                    $.easyUnblockUI();
                }
            });
        });

    </script>
@endpush
