@extends('layouts.app')

@push('datatable-styles')
    @include('sections.datatable_css')
@endpush

@section('filter-section')
    <div class="d-flex d-lg-block filter-box project-header bg-white">
        <div class="mobile-close-overlay w-100 h-100" id="close-client-overlay"></div>

        <div class="project-menu" id="mob-client-detail">
            <a class="d-none close-it" href="javascript:;" id="close-client-detail">
                <i class="fa fa-times"></i>
            </a>

            <nav class="tabs">
                <ul class="-primary">
                    <li>
                        <x-tab :href="route('payroll-reports.index')" :text="__('payroll::modules.payroll.export')" class="salary-report" ajax="false"/>
                    </li>
                    <li>
                        <x-tab :href="route('payroll-reports.index').'?tab=company-tds'" :text="__('payroll::modules.payroll.companyTdsReport')" class="company-tds" ajax="false"/>
                    </li>

                    <li>
                        <x-tab :href="route('payroll-reports.index').'?tab=employee-tds'" :text="__('payroll::modules.payroll.employeeTdsReport')" class="employee-tds" ajax="false"/>
                    </li>

                </ul>
            </nav>
        </div>
    </div>

@endsection

@section('content')
    <div class="content-wrapper pt-0 border-top-0 client-detail-wrapper">
        @include($view)
    </div>
@endsection


@push('scripts')

    <script>

        $("body").on("click", ".project-menu .ajax-tab", function(event) {
            event.preventDefault();

            $('.project-menu .p-sub-menu').removeClass('active');
            $(this).addClass('active');

            const requestUrl = this.href;

            $.easyAjax({
                url: requestUrl,
                blockUI: true,
                container: ".content-wrapper",
                historyPush: true,
                success: function(response) {
                    if (response.status == "success") {
                        $('.content-wrapper').html(response.html);
                        init('.content-wrapper');
                    }
                }
            });
        });
    </script>

    <script>

        const activeTab = "{{ $activeTab }}";
        $('.project-menu .' + activeTab).addClass('active');

    </script>

@endpush
