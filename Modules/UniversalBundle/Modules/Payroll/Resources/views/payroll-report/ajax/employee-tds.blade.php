@section('content')
<div class="content-wrapper">
    <form action="" id="filter-form">
        <div class="select-box d-flex py-2 px-lg-2 px-md-2 px-0 border-right-grey border-right-grey-sm-0 ">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('modules.messages.chooseMember')</p>
            <div class="select-status">
                <select class="form-control select-picker" name="user_id" id="user_id" data-live-search="true"
                    data-size="8">
                    <option value="">--</option>
                    @foreach ($employees as $employee)
                        <x-user-option :user="$employee" />
                    @endforeach
                </select>
            </div>
        </div>
    </form>
</div>
<!-- CONTENT WRAPPER START -->
<div class="content-wrapper"id="paidTds">
    <!-- Widget Start -->
    <div class="d-flex flex-column">
        <div class="row mb-4">
            <div class="col-lg-3">
                <x-cards.widget :title="__('payroll::modules.payroll.tdsCharged')" value="0"
                                icon="coins" widgetId="tds"/>
            </div>
        </div>
    </div>
    <!-- Widget End -->
</div>
<div class="row">
    <div class="col-md-12" id="full-tds"></div>
</div>
        
<!-- CONTENT WRAPPER END -->
@endsection

@push('scripts')
    <script>
        $('#user_id').change(function (e) {
            $('#paidTds').hide();
            let userId = $(this).val();

            var url = "{{ route('payroll-reports.fetch_tds', ':id') }}";
            url = url.replace(':id', userId);

            $.easyAjax({
                url: url,
                type: "GET",
                success: function (response) {
                    if (response.status == 'success') {
                        console.log(response);
                        $('#full-tds').html(response.html);
                    }
                }
            })
        });
    </script>
@endpush
