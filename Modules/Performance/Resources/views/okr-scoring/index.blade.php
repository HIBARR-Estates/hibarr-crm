@extends('layouts.app')

@push('datatable-styles')
    @include('sections.datatable_css')
@endpush

@push('styles')
    <style>
        .table-container {
            width: 100%;
            border-collapse: collapse;
        }
        .table-container th, .table-container td {
            padding: 10px;
            text-align: center;
            border: 1px solid #ddd;
        }
        .grading-scale {
            display: flex;
            justify-content: space-evenly;
            padding: 5px 0;
        }
        .grading-scale span {
            padding: 5px 10px;
            color: #fff;
            font-weight: bold;
            border-radius: 4px;
            margin: 0 2px;
        }
        .bg-red { background-color: #e74c3c; }
        .bg-yellow { background-color: #f1c40f; }
        .bg-green { background-color: #2ecc71; }


        /* datepicker css */
        .ui-datepicker-calendar, .ui-datepicker-current {
            display: none !important;
        }

        .monthYearPicker .ui-datepicker-calendar {
            display: none;
        }
    </style>
@endpush

<!-- Helper function to get the grading class based on the score -->
@php
function getGradingClass($score) {
    if ($score < 0.4) {
        return 'bg-red';
    } elseif ($score < 0.7) {
        return 'bg-yellow';
    } else {
        return 'bg-green';
    }
}
@endphp

@section('filter-section')
    <x-filters.filter-box>
        <!-- DATE START -->
        {{-- <div class="select-box d-flex mb-0 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.select') @lang('app.month')</p>
            <div class="d-flex">
                <input type="text" class="form-control f-14" placeholder="{{ __('app.month') }}" format="MM YYYY" value="{{ $monthYear }}" name="monthYear" id="monthYear">
            </div>
        </div> --}}

        <div class="select-box d-flex pr-2 border-right-grey border-right-grey-sm-0">
            <p class="mb-0 pr-2 f-14 text-dark-grey d-flex align-items-center">@lang('app.duration')</p>
            <div class="select-status d-flex">
                <input type="text"
                    class="position-relative text-dark form-control border-0 p-2 text-left f-14 f-w-500 border-additional-grey"
                    id="datatableRange2" placeholder="@lang('placeholders.dateRange')">
            </div>
        </div>
        <!-- DATE END -->

        <!-- RESET START -->
        <div class="select-box d-flex py-1 px-lg-2 px-md-2 px-0">
            <x-forms.button-secondary class="btn-xs d-none" id="reset-filters" icon="times-circle">
                @lang('app.clearFilters')
            </x-forms.button-secondary>

            <a href="javascript:;" onclick="downloadReport('monthly')" class="ml-2">
                <x-forms.button-primary id="monthlySheet"
                    icon="download">@lang('performance::app.downloadSheet')
                </x-forms.button-primary>
            </a>
        </div>

        <!-- RESET END -->

    </x-filters.filter-box>

@endsection

@section('content')
    <!-- CONTENT WRAPPER START -->
    <div class="content-wrapper px-4">

        <x-alert type="info" icon="info-circle">
            @lang('performance::messages.downloadMessage')
        </x-alert>
        <!-- Task Box End -->
    </div>
    <!-- CONTENT WRAPPER END -->
@endsection

@push('scripts')
    <script src="{{ asset('vendor/jquery/daterangepicker.min.js') }}"></script>
    <script>
        var start = moment().clone().startOf('month');
        var end = moment();

        function setDate() {
            $('#datatableRange2').daterangepicker({
                locale: daterangeLocale,
                linkedCalendars: false,
                startDate: start,
                endDate: end,
                ranges: daterangeConfig
            }, cb);
        }

        setDate();

        function downloadReport(type) {
            var startDate = $('#datatableRange2').val();

            if (startDate == '') {
                startDate = null;
                endDate = null;
            } else {
                var dateRangePicker = $('#datatableRange2').data('daterangepicker');
                startDate = dateRangePicker.startDate.format('{{ company()->moment_date_format }}');
                endDate = dateRangePicker.endDate.format('{{ company()->moment_date_format }}');
            }

            var url = "{{ route('okr-scoring.export-report') }}";
            window.location = `${url}?startDate=${startDate}&endDate=${endDate}`;
        };

        $('#reset-filters').click(function () {
            $('#filter-form')[0].reset();
            $('.filter-box .select-picker').selectpicker("refresh");
            $('#reset-filters').addClass('d-none');

            setDate();
        });
    </script>
@endpush
    