@extends('layouts.app')

@push('datatable-styles')
    @include('sections.datatable_css')
@endpush

@section('filter-section')

    <x-filters.filter-box>
        <!-- ACCOUNT TYPE -->
        <div class="select-box d-flex py-2 px-lg-2 px-md-2 px-0 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-3 f-14 text-dark-grey d-flex align-items-center">@lang('qrcode::app.fields.type')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="type" id="filter_type"
                data-container="body" data-live-search="true" data-size="8">
                    <option value="all">@lang('app.all')</option>
                    @foreach (\Modules\QRCode\Enums\Type::cases() as $type)
                        <option value="{{ $type->value }}">{{ $type->label() }}</option>
                    @endforeach
                </select>
            </div>
        </div>
        <!-- ACCOUNT TYPE END -->

        <!-- SEARCH BY TASK START -->
        <div class="task-search d-flex  py-1 px-lg-3 px-0 border-right-grey align-items-center">
            <form class="w-100 mr-1 mr-lg-0 mr-md-1 ml-md-1 ml-0 ml-lg-0">
                <div class="input-group bg-grey rounded">
                    <div class="input-group-prepend">
                        <span class="input-group-text border-0 bg-additional-grey">
                            <i class="fa fa-search f-13 text-dark-grey"></i>
                        </span>
                    </div>
                    <input type="text" class="form-control f-14 p-1 border-additional-grey" id="search-text-field"
                        placeholder="@lang('app.startTyping')">
                </div>
            </form>
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
        <div class="d-block d-lg-flex d-md-flex justify-content-between">
            <div id="table-actions" class="flex-grow-1 align-items-center mb-2 mb-lg-0 mb-md-0">
                @if(user()->permission('add_qrcode') != 'none')
                    <x-forms.link-primary :link="route('qrcode.create')" class="mr-3 float-left mb-2 mb-lg-0 mb-md-0" icon="plus">
                        @lang('qrcode::app.createQrCode')
                    </x-forms.link-primary>
                @endif

            </div>
        </div>

        <!-- Add Task Export Buttons End -->
        <!-- Task Box Start -->
        <div class="d-flex flex-column w-tables rounded mt-3 bg-white w-100 table-responsive">

            {!! $dataTable->table(['class' => 'table table-hover border-0 w-100']) !!}

        </div>
        <!-- Task Box End -->
    </div>
    <!-- CONTENT WRAPPER END -->

@endsection

@push('scripts')
    @include('sections.datatable_js')
    <script>
        $(function() {

            $('#qrcode-table').on('preXhr.dt', function(e, settings, data) {

                var searchText = $('#search-text-field').val();
                var filterType = $('#filter_type').val();

                data['searchText'] = searchText;
                data['type'] = filterType;
            });

            const showTable = () => {
                window.LaravelDataTables["qrcode-table"].draw(true);
            }

            $('#reset-filters,#reset-filters-2').click(function () {
                $('#filter-form')[0].reset();

                $('.filter-box .select-picker').selectpicker("refresh");
                $('#reset-filters').addClass('d-none');
                showTable();
            });

            $('#filter_type, #search-text-field')
            .on('change keyup', function() {
                        if ($('#filter_type').val() != "all") {
                            $('#reset-filters').removeClass('d-none');
                            showTable();
                        } else if ($('#search-text-field').val() != "") {
                            $('#reset-filters').removeClass('d-none');
                            showTable();
                        } else {
                            $('#reset-filters').addClass('d-none');
                            showTable();
                        }
            });

            $('body').on('click', '.delete-qr-table-row', function() {
                var id = $(this).data('qr-id');
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
                        var url = "{{ route('qrcode.destroy', ':id') }}";
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
                                    showTable();
                                }
                            }
                        });
                    }
                });
            });

            $('body').on('click', '.qr-img-lightbox', function () {
                const id = $(this).data('id');
                var url = "{{ route('qrcode.show', ':id') }}";
                url = url.replace(':id', id);
                $(MODAL_DEFAULT + ' ' + MODAL_HEADING).html('...');
                $.ajaxModal(MODAL_DEFAULT, url);
            });

        });
    </script>
@endpush
