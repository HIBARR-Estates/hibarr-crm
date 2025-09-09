@extends('layouts.app')

@push('styles')
<style>
    .information-box {
        border-style: dotted;
        border-radius: 4px;
    }
</style>
@endpush

@section('content')

    <!-- SETTINGS START -->
    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <nav class="tabs px-4 border-bottom-grey">
                        <div class="nav" id="nav-tab" role="tablist">
                            <a class="nav-item nav-link f-15 active security"
                               href="{{ route('cybersecurity.index') }}" role="tab"
                               aria-controls="nav-security" aria-selected="true">@lang($pageTitle)
                            </a>

                            <a class="nav-item nav-link f-15 blacklistIp"
                               href="{{ route('cybersecurity.index') }}?tab=blacklistIp" role="tab"
                               aria-controls="nav-blacklistIp"
                               aria-selected="true">@lang('cybersecurity::app.blacklistIp')
                            </a>

                            <a class="nav-item nav-link f-15 blacklistEmail"
                               href="{{ route('cybersecurity.index') }}?tab=blacklistEmail" role="tab"
                               aria-controls="nav-blacklistEmail"
                               aria-selected="true">@lang('cybersecurity::app.blacklistEmail')
                            </a>

                            <a class="nav-item nav-link f-15 login-expiry"
                               href="{{ route('cybersecurity.index') }}?tab=login-expiry" role="tab"
                               aria-controls="nav-login-expiry"
                               aria-selected="true">@lang('cybersecurity::app.loginExpiry')
                            </a>

                            <a class="nav-item nav-link f-15 single-session"
                                href="{{ route('cybersecurity.index') }}?tab=single-session" role="tab"
                                aria-controls="nav-single-session"
                                aria-selected="true">@lang('cybersecurity::app.singleSession')
                            </a>

                        </div>
                    </nav>
                </div>
            </x-slot>

            <x-slot name="buttons">
                <div class="row">

                    <div class="col-md-12 mb-2">

                        <x-forms.button-primary icon="plus" id="add-blacklistIp" class="blacklistIp-btn mb-2 actionBtn d-none">
                            @lang('cybersecurity::app.addIp')
                        </x-forms.button-primary>

                        <x-forms.button-primary icon="plus" id="add-blacklistEmail"
                                    class="blacklistEmail-btn d-none mb-2 actionBtn"> @lang('cybersecurity::app.addEmail')
                        </x-forms.button-primary>

                        <x-forms.button-primary icon="plus" id="add-loginExpiry"
                                    class="login-expiry-btn d-none mb-2 actionBtn"> @lang('cybersecurity::app.addUser')
                        </x-forms.button-primary>
                    </div>

                </div>
            </x-slot>

            @include($view)

        </x-setting-card>

    </div>
    <!-- SETTINGS END -->
@endsection

@push('scripts')

    <script>

        $('.nav-item').removeClass('active');
        const activeTab = "{{ $activeTab }}";
        $('.' + activeTab).addClass('active');

        $("body").on("click", "#editSettings .nav a", function(event) {
            event.preventDefault();

            $('.nav-item').removeClass('active');
            $(this).addClass('active');

            const requestUrl = this.href;

            $.easyAjax({
                url: requestUrl,
                blockUI: true,
                container: "#nav-tabContent",
                historyPush: true,
                success: function(response) {
                    showBtn(response.activeTab);
                    if (response.status == "success") {
                        $('#nav-tabContent').html(response.html);
                        init('#nav-tabContent');
                    }
                }
            });
        });

        function showBtn(activeTab) {
            $('.actionBtn').addClass('d-none');
            $('.' + activeTab + '-btn').removeClass('d-none');
        }

        showBtn(activeTab);
    </script>
@endpush
