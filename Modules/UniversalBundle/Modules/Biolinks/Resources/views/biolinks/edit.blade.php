@extends('layouts.app')

@push('styles')
    <style>
        .iframe-wrapper {
            position: fixed;
            top: 156px;
            right: 0px;
            bottom: 20px;
            left: auto;
            width: 40%;
            height: -webkit-fill-available;
            overflow: auto;
        }

        .iframe-container {
            max-width: 468px;
            margin: 0 auto;
            padding: 20px;
            background-color: #adb2ae;
            border-radius: 45px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            height: 100%;
        }

        .iframe-container iframe {
            border-radius: 30px;
            width: 100%;
            height: 100%;
        }

    </style>
@endpush

@section('filter-section')
    <div class="d-flex filter-box project-header bg-white">
        <div class="mobile-close-overlay w-100 h-100" id="close-client-overlay"></div>
        <div class="project-menu d-lg-flex" id="mob-client-detail">
            <a class="d-none close-it" href="javascript:;" id="close-client-detail">
                <i class="fa fa-times"></i>
            </a>

            <!-- Tabs  -->
            <div class="row">
                <div class="col-md-12">
                    <ul class="nav nav-tabs">
                        <li class="nav-item active text-dark-grey  border-right-grey">
                            <a class="nav-link active" href="#settings" data-toggle="tab">@lang('biolinks::app.menu.settings')</a>
                        </li>
                        <li class="nav-item text-dark-grey  border-right-grey">
                            <a class="nav-link" href="#blocks" data-toggle="tab">@lang('biolinks::app.menu.blocks')</a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
@endsection

@section('content')
    <div class="content-wrapper border-top-0 client-detail-wrapper">
        <div class="tab-content" id="nav-tabContent">
            <div class="card border-0 invoice">
                <!-- CARD BODY START -->
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="row">
                                <div class="col-md-12 mt-3 mb-3">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <h4 class="font-weight-bold f-21 text-dark mt-lg-0 mt-md-0">
                                                {{ $biolinkSettings->biolink->page_link }}
                                            </h4>

                                        </div>
                                        <div class="col-md-6 text-right mb-2">
                                            <x-forms.link-primary icon="plus" id="addBlock" :link="route('biolink-blocks.create', ['id' => $id])"
                                                class="type-btn actionBtn openRightModal">@lang('app.add')
                                                @lang('biolinks::app.menu.block')
                                            </x-forms.link-primary>
                                        </div>
                                        <div class="col-12">
                                            <div class="d-flex">
                                                <span>
                                                    @lang('biolinks::app.yourUrl'): <a target="_blank"
                                                    href="{{ route('biolink.index', $biolinkSettings->biolink->page_link) }}">{{ route('biolink.index', $biolinkSettings->biolink->page_link) }}</a>
                                                </span>
                                                <i id="edit-biolink" class="fa fa-edit ml-2 mt-auto mb-1" data-toggle="popover" data-placement="top" data-content="@lang('app.edit')" data-html="true" data-trigger="hover" data-id="{{ $id }}"></i>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-12 tab-content">
                                    <div class="tab-pane active" id="settings">
                                        @include('biolinks::biolinks.ajax.settings')
                                    </div>
                                    <div class="tab-pane" id="blocks">
                                        @include('biolinks::biolinks.ajax.blocks')
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6 mt-5">
                            <div class="iframe-wrapper">
                                <div class="iframe-container">
                                <iframe id="livePreview" width="100%" height="800px" frameborder="0"></iframe>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    <script>
        // Check local storage for active tab
        var activeTab = localStorage.getItem('activeTab');
        // Activate the corresponding tab
        if (activeTab == 'blocks') {
            $('a[href="#' + activeTab + '"]').tab('show');
            localStorage.removeItem('activeTab');
        }

        function iframePreview() {

            let id = '{{ $biolinkSettings->id }}';
            let url = "{{ route('biolinks.show-preview', ':id') }}";
            url = url.replace(':id', id);

            $.easyAjax({
                url: url,
                type: "GET",
                disableButton: true,
                buttonSelector: '#save-biolink-setting',
                success: function(response) {
                    if (response.status == 'success') {
                        $('#livePreview').attr('srcdoc', response.html);
                    }
                }
            });
        }

        iframePreview();

        // Delete biolink...
        $('body').on('click', '.delete-table-row', function() {
            var id = $(this).data('id');
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
                    var url = "{{ route('lead-contact.destroy', ':id') }}";
                    url = url.replace(':id', id);

                    var token = "{{ csrf_token() }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        data: {
                            '_token': token,
                            '_method': 'DELETE'
                        },
                        success: function(response) {
                            if (response.status == "success") {
                                window.location.href = "{{ route('lead-contact.index') }}";
                            }
                        }
                    });
                }
            });
        });

        init();

        $('body').on('click', '#edit-biolink', function() {
            var id = $(this).data('id');
            var url = "{{ route('biolinks.editSlug', ':id') }}";
            url = url.replace(':id', id);
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });
    </script>
@endpush
