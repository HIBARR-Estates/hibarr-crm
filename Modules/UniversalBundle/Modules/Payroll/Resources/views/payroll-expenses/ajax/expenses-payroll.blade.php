
<!-- ROW START -->
<div class="row">
    <div class="col-lg-12 col-md-12 mb-4 mb-xl-0 mb-lg-4">
        <!-- Add Task Export Buttons Start -->
        <!-- Add Task Export Buttons End -->

        <form action="" id="filter-form">
            <div class="d-block d-lg-flex d-md-flex my-3">


                <!-- SEARCH BY TASK START -->
                <div class="select-box py-2 px-lg-2 px-md-2 px-0 mr-3">
                    <x-forms.label fieldId="status" />
                    <div class="input-group bg-grey rounded">
                        <div class="input-group-prepend">
                            <span class="input-group-text bg-additional-grey">
                                <i class="fa fa-search f-13 text-dark-grey"></i>
                            </span>
                        </div>
                        <input type="text" class="form-control f-14 p-1 height-35 border" id="search-text-field"
                            placeholder="@lang('app.startTyping')">
                    </div>
                </div>
                <!-- SEARCH BY TASK END -->
            </div>
        </form>

        <!-- Task Box Start -->
        <div class="d-flex flex-column w-tables rounded mt-3 bg-white">

            {!! $dataTable->table(['class' => 'table table-hover border-0 w-100']) !!}

        </div>
        <!-- Task Box End -->
    </div>
</div>
<!-- ROW END -->
@include('sections.datatable_js')

<script>
    $('#expenses-salary-slip-table').on('preXhr.dt', function(e, settings, data) {
        var expenseID = "{{ $expense->id }}";
        var status = $('#status').val();
        var searchText = $('#search-text-field').val();

        data['expenseId'] = expenseID;
        data['status'] = status;
        data['searchText'] = searchText;
    });
    const showTable = () => {
        window.LaravelDataTables["expenses-salary-slip-table"].draw(false);
    }

    $('#search-text-field').on('keyup', function() {
        if ($('#search-text-field').val() != "") {
            $('#reset-filters').removeClass('d-none');
            showTable();
        }
    });

</script>
