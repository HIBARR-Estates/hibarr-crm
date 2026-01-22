@extends('layouts.app')

@section('content')

    <!-- SETTINGS START -->
    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>

            <x-slot name="buttons">
                <div class="row">
                    <div class="col-md-12 mb-2">
                        <x-forms.button-primary icon="plus" id="addNewPackage" class="addNewPackage mb-2">
                            @lang('app.add') @lang('app.menu.packages')
                        </x-forms.button-primary>
                    </div>
                </div>
            </x-slot>

            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                        @lang($pageTitle)</h2>
                </div>
            </x-slot>

            <!-- PACKAGES SETTING START -->
            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">

                <div class="table-responsive">
                    <x-table class="table-bordered">
                        <x-slot name="thead">
                            <th>#</th>
                            <th>@lang('app.name')</th>
                            <th>@lang('app.value')</th>
                            <th>@lang('app.description')</th>
                            <th>@lang('app.customerTypeName')</th>
                            <th class="text-right">@lang('app.action')</th>
                        </x-slot>

                        @forelse($packages as $key => $package)
                            <tr id="package-{{ $package->id }}" class="p-5 min-h-100">
                                <td>
                                    {{ $key + 1 }}
                                </td>
                                <td>
                                    {{ $package->name }}
                                </td>
                                <td>
                                    {{ number_format($package->value, 2) }}
                                </td>
                                <td>
                                    {{ $package->description ? Str::limit($package->description, 50) : '--' }}
                                </td>
                                <td>
                                    {{ $package->customer_type_name ?? '--' }}
                                </td>
                                <td class="text-right">
                                    <div class="task_view">
                                        <a href="javascript:;" data-package-id="{{ $package->id }}"
                                           class="editPackage task_view_more d-flex align-items-center justify-content-center">
                                            <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                                        </a>
                                    </div>
                                    <div class="task_view mt-1 mt-lg-0 mt-md-0">
                                        <a href="javascript:;" data-package-id="{{ $package->id }}"
                                           class="delete-package task_view_more d-flex align-items-center justify-content-center">
                                            <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="6">
                                    <x-cards.no-record icon="box" :message="__('messages.noRecordFound')"/>
                                </td>
                            </tr>
                        @endforelse
                    </x-table>
                </div>

            </div>
            <!-- PACKAGES SETTING END -->

        </x-setting-card>

    </div>
    <!-- SETTINGS END -->

@endsection

@push('scripts')

    <script>

        $('body').on('click', '.delete-package', function () {

            var id = $(this).data('package-id');

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

                    var url = "{{ route('packages.destroy', ':id') }}";
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
                                $('#package-' + id).fadeOut();
                                init();
                            }
                        }
                    });
                }
            });
        });

        // add new package
        $('#addNewPackage').click(function () {
            var url = "{{ route('packages.create') }}";
            $(MODAL_XL + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_XL, url);
        });

        $(MODAL_LG).on('shown.bs.modal', function () {
            $('#page_reload').val('true')
        })

        // edit package
        $('.editPackage').click(function () {

            var id = $(this).data('package-id');

            var url = "{{ route('packages.edit', ':id') }}";
            url = url.replace(':id', id);

            $(MODAL_XL + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_XL, url);
        });

    </script>
@endpush
