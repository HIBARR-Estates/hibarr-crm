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
    <div class="mt-3 bg-white rounded d-flex flex-column w-tables ">
        <input type="hidden" name="_method" value="POST">
        {!! $dataTable->table(['class' => 'table table-hover border-0 w-100']) !!}
    </div>

    <div class="w-100 border-top-grey set-btns">
        <x-setting-form-actions>
            <x-forms.button-primary id="save-hourly-rate" class="mr-3" icon="check">@lang('app.save')
            </x-forms.button-primary>
        </x-setting-form-actions>
    </div>
</div>

@include('sections.datatable_js')

    <script type="text/javascript">

    $('#employee-hourly-rate').on('preXhr.dt', function(e, settings, data) {
        var searchText = $('#search-text-field').val();
        var user_id = $('#user_id').val();
        data['searchText'] = searchText;
        data['user_id'] = user_id;
    });

    const showTable = () => {
        window.LaravelDataTables["employee-hourly-rate"].draw(false);
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

    $(document).ready(function() {
        $('#save-hourly-rate').click(function () {
            var token = "{{ csrf_token() }}";
            $.easyAjax({
                url: "{{ route('employee-hourly-rate-settings.store') }}",
                container: '#employee-hourly-rate',
                type: "POST",
                blockUI: true,
                disableButton: true,
                buttonSelector: "#save-hourly-rate",
                data: $('#editSettings').serialize(),
                success: function (response) {
                    showTable();
                }
            })
        });
     });


    </script>
