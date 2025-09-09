
@section('content')
<link href="https://cdnjs.cloudflare.com/ajax/libs/datepicker/1.0.10/datepicker.css" rel="stylesheet">

<style>
    .ui-datepicker-calendar, .ui-datepicker-current {
    display: none !important;
    }
    .monthYearPicker .ui-datepicker-calendar {
    display: none;
}
</style>
<div class="content-wrapper">
    <x-form id="report-payroll-form">
        <div class="row">
            <div class="col-md-3">
                <div class = "form-group my-3">
                    <x-forms.label fieldId="startDate" :fieldLabel="__('payroll::modules.payroll.selectMonth')"></x-forms.label>
                    <input type="text" class="form-control height-35 f-14" placeholder="{{ __('app.date') }}" format="MM YYYY"   value="{{ $startDate }}" name="startDate" id="startDate">
                </div>
            </div>
            <div class="col-md-3">
                <div class = "form-group my-3">
                    <x-forms.label fieldId="startDate" :fieldLabel="__('payroll::modules.payroll.selectMonth')" ></x-forms.label>
                    <input type="text" class="form-control height-35 f-14" value="{{ $startDate }}" name="endDate" id="endDate">
                </div>
            </div>

            <div class="col-md-3">
                <x-forms.select fieldId="department" :fieldLabel="__('app.department')" fieldName="department"
                                search="true">
                    <option value="all">{{ __('app.all') }}</option>

                    @foreach ($departments as $department)
                        <option value="{{ $department->id }}">{{ $department->team_name }}</option>
                    @endforeach

                </x-forms.select>
            </div>
            <div class="col-md-3">
                <x-forms.select fieldId="designation" :fieldLabel="__('app.designation')" fieldName="designation"
                                search="true">
                    <option value="all">{{ __('app.all') }}</option>

                    @foreach ($designations as $designation)
                        <option value="{{ $designation->id }}">{{ $designation->name }}</option>
                    @endforeach

                </x-forms.select>
            </div>
        </div>
    </x-form>
</div>
<!-- CONTENT WRAPPER START -->
<div class="content-wrapper"id="paidTds">
    <!-- Widget Start -->
    <div class="d-flex flex-column">
        <div class="row mb-4">
            <div class="col-lg-12 d-flex justify-content-center">
                <div class="border-top-grey px-4  justify-content-center py-3">
                    <a href="javascript:;" onclick="downloadReport('monthly')">
                        <x-forms.button-primary id="monthlySheet"
                                                icon="download">@lang('payroll::modules.payroll.monthlySheet')
                        </x-forms.button-primary>
                    </a>
                </div>
                <div class="border-top-grey justify-content-center px-4 py-3">
                    <a href="javascript:;" onclick="downloadReport('cumulative')">
                        <x-forms.button-secondary id="generate-payslip"
                                                icon="download">@lang('payroll::modules.payroll.cumulativeSheet')
                        </x-forms.button-secondary>
                    </a>
                </div>
            </div>
        </div>
    </div>
    <!-- Widget End -->
</div>


<!-- CONTENT WRAPPER END -->
@endsection

@push('scripts')

<script src="https://cdnjs.cloudflare.com/ajax/libs/datepicker/1.0.10/datepicker.js"></script>
    <script>

    $(document).ready(function () {
    var today = new Date();
    var currentMonth = today.getMonth();
    var currentYear = today.getFullYear();
    var endOfMonth = new Date(currentYear, currentMonth + 1, 0);

    $('#startDate').datepicker({
        format: 'mm-yyyy',
        viewMode: 'months',
        minViewMode: 'months',
        // startDate: new Date(currentYear, currentMonth, 1), // Start date must be this month
        endDate: endOfMonth, // End date cannot exceed the current month
    })

    $('#endDate').datepicker({
        format: 'mm-yyyy',
        viewMode: 'months',
        minViewMode: 'months',
        // startDate: new Date(currentYear, currentMonth, 1), // Start date must be this month
         endDate: endOfMonth, // End date cannot exceed the current month
    })
});

    function downloadReport(type) {
        let startDate = $('#startDate').val();
        let endDate = $('#endDate').val();
        let department = $('#department').val();
        let designation = $('#designation').val();
        var url = "{{ route('payroll-reports.export-report') }}?type="+type+"&startDate="+startDate+"&endDate="+endDate+"&department="+department+"&designation="+designation;
        window.location.href = url;

    };
    </script>
@endpush
