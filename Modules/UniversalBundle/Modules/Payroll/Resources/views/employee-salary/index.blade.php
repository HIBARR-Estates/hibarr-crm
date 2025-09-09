@extends('layouts.app')

@push('datatable-styles')
    @include('sections.datatable_css')
@endpush

@section('filter-section')

    <x-filters.filter-box>

        <!-- DESIGNATION START -->
        <div class="select-box d-flex py-2 px-lg-3 px-md-3 px-0 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.designation')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="designation" id="designation" data-live-search="true">
                    <option value="all">@lang('app.all')</option>
                    @foreach ($designations as $designation)
                        <option value="{{ $designation->id }}">{{ ($designation->name) }}</option>
                    @endforeach
                </select>
            </div>
        </div>
        <!-- DESIGNATION END -->

        <!-- DEPARTMENT START -->
        <div class="select-box d-flex py-2 px-lg-3 px-md-3 px-0 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.department')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="department" id="department" data-live-search="true">
                    <option value="all">@lang('app.all')</option>
                    @foreach ($departments as $department)
                        <option value="{{ $department->id }}">{{ ($department->team_name) }}</option>
                    @endforeach
                </select>
            </div>
        </div>
        <!-- DEPARTMENT END -->


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
        <div class="select-box d-flex py-2 px-lg-3 px-md-3 px-0">
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
        <div class="d-flex" id="table-actions">

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
        $('#employee-salary-table').on('preXhr.dt', function (e, settings, data) {

            const designation = $('#designation').val();
            const department = $('#department').val();
            const searchText = $('#search-text-field').val();
            data['designation'] = designation;
            data['department'] = department;
            data['searchText'] = searchText;
        });
        const showTable = () => {
            window.LaravelDataTables["employee-salary-table"].draw(true);
        }

        $('#designation, #department, #search-text-field').on('change keyup',
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

        $('body').on('click', '.save-initial-salary', function () {
            const id = $(this).data('user-id');
            const amount = $('#initial-salary-' + id).val();
            const token = "{{ csrf_token() }}";

            $.easyAjax({
                url: "{{ route('employee-salary.store') }}",
                container: '#employee-salary-table',
                type: "POST",
                blockUI: true,
                disableButton: true,
                buttonSelector: "#save-initial-salary",
                data: {user_id: id, amount: amount, _token: token, type: 'initial'},
                success: function (response) {
                    if (response.status === "success") {
                        showTable();
                    }
                }
            });

        });

        $('body').on('click', '.salary-history', function () {
            const userId = $(this).data('user-id');
            let url = '{{ route("employee-salary.show", ":id")}}';
            url = url.replace(':id', userId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('body').on('click', '.update-salary', function () {
            const userId = $(this).data('user-id');
            let url = '{{ route("employee-salary.edit", ":id")}}';
            url = url.replace(':id', userId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('body').on('change', '.salary-cycle', function () {
            const id = $(this).data('user-id');
            const cycle = $(this).val();
            const token = "{{ csrf_token() }}";
            if (id !== undefined && id !== '') {
                $.easyAjax({
                    url: '{{route("employee-salary.payroll-cycle")}}',
                    type: "POST",
                    data: {user_id: id, cycle: cycle, _token: token},
                    success: function (response) {
                        if (response.status == "success") {
                            showTable();
                        }
                    }
                })
            }


        });

        $('body').on('change', '.payroll-status', function () {
            const id = $(this).data('user-id');
            const status = $(this).val();
            const token = "{{ csrf_token() }}";
            if (id !== undefined && id != '') {
                $.easyAjax({
                    url: '{{route("employee-salary.payroll-status")}}',
                    type: "POST",
                    data: {user_id: id, status: status, _token: token},
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
