@extends('layouts.app')

@section('content')

    <!-- SETTINGS START -->
    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        @lang($pageTitle)
                    </h2>
                    <!-- Tab Navigation -->
                    <div class="px-3 pb-0">
                        <ul class="nav nav-pills nav-justified mb-0" id="crm-event-tabs" role="tablist">
                            <li class="nav-item">
                                <a class="nav-link f-14 rounded-0 border-bottom-0 active" id="categories-tab"
                                   data-toggle="pill" href="#categories-panel" role="tab">
                                    <i class="fa fa-th-large mr-1"></i> Categories
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link f-14 rounded-0 border-bottom-0" id="types-tab"
                                   data-toggle="pill" href="#types-panel" role="tab">
                                    <i class="fa fa-tags mr-1"></i> Event Types
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link f-14 rounded-0 border-bottom-0" id="rules-tab"
                                   data-toggle="pill" href="#rules-panel" role="tab">
                                    <i class="fa fa-cogs mr-1"></i> Business Rules
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link f-14 rounded-0 border-bottom-0" id="retention-tab"
                                   data-toggle="pill" href="#retention-panel" role="tab">
                                    <i class="fa fa-archive mr-1"></i> Retention
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-0">
                <div class="tab-content" id="crm-event-tab-content">
                    <!-- Categories Tab -->
                    <div class="tab-pane fade show active p-4" id="categories-panel" role="tabpanel">
                        @include('company-settings.crm-events.categories-tab')
                    </div>

                    <!-- Event Types Tab -->
                    <div class="tab-pane fade p-4" id="types-panel" role="tabpanel">
                        @include('company-settings.crm-events.types-tab')
                    </div>

                    <!-- Business Rules Tab -->
                    <div class="tab-pane fade p-4" id="rules-panel" role="tabpanel">
                        @include('company-settings.crm-events.rules-tab')
                    </div>

                    <!-- Retention Tab -->
                    <div class="tab-pane fade p-4" id="retention-panel" role="tabpanel">
                        @include('company-settings.crm-events.retention-tab')
                    </div>
                </div>
            </div>

        </x-setting-card>

    </div>
    <!-- SETTINGS END -->
@endsection

@push('scripts')
    <script>
        // Activate tab from URL ?tab= parameter
        $(document).ready(function () {
            var urlParams = new URLSearchParams(window.location.search);
            var tab = urlParams.get('tab');
            if (tab) {
                var tabMap = {
                    'categories': '#categories-tab',
                    'types': '#types-tab',
                    'rules': '#rules-tab',
                    'retention': '#retention-tab'
                };
                if (tabMap[tab]) {
                    $(tabMap[tab]).tab('show');
                }
            }
        });

        // Status toggle (shared across all tabs)
        $('body').on('change', '.crm-event-status-toggle', function () {
            var entityType = $(this).data('entity-type');
            var id = $(this).data('entity-id');
            var status = $(this).is(':checked') ? 'active' : 'inactive';

            $.easyAjax({
                url: "{{ route('crm-event-settings.change-status') }}",
                type: "POST",
                data: {
                    '_token': "{{ csrf_token() }}",
                    'entity_type': entityType,
                    'id': id,
                    'status': status
                }
            });
        });

        // Delete entity (shared across all tabs)
        $('body').on('click', '.crm-event-delete', function () {
            var url = $(this).data('url');
            var row = $(this).closest('tr');

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
                showClass: { popup: 'swal2-noanimation', backdrop: 'swal2-noanimation' },
                buttonsStyling: false
            }).then(function (result) {
                if (result.isConfirmed) {
                    $.easyAjax({
                        url: url,
                        type: "DELETE",
                        data: { '_token': "{{ csrf_token() }}" },
                        success: function (response) {
                            if (response.status === 'success') {
                                row.fadeOut(300, function () { $(this).remove(); });
                            }
                        }
                    });
                }
            });
        });

        // Retention policy save
        $('#save-retention').click(function () {
            $.easyAjax({
                url: "{{ route('crm-event-retention.update') }}",
                container: '#retention-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#save-retention",
                data: $('#retention-form').serialize() + '&_token={{ csrf_token() }}'
            });
        });
    </script>
@endpush
