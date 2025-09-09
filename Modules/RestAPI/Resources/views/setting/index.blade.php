@extends('layouts.app')

@section('content')

    <!-- SETTINGS START -->
    <div class="w-100 d-flex ">

        <x-setting-sidebar :activeMenu="$activeSettingMenu"/>

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                        @lang($pageTitle)</h2>
                </div>
            </x-slot>

            @if($restAPISetting->fcm_key && user()->permission('manage_test_push_notification'))
                <x-slot name="buttons">
                    <div class="row">
                        <div class="col-md-12 mb-2">
                            <x-forms.button-secondary icon="mobile" id="testAndroidPushNotification">
                                @lang('restapi::app.testAndroidPushNotification')
                            </x-forms.button-secondary>
                            <x-forms.button-secondary icon="mobile" id="testIOSPushNotification">
                                @lang('restapi::app.testIOSPushNotification')
                            </x-forms.button-secondary>
                        </div>
                    </div>
                </x-slot>
            @endif

            @if(user()->permission('manage_rest_api_settings'))
                <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
                    @method('PUT')
                    <div class="row">
                        <div class="col-lg-12">
                            <x-forms.label class="mt-3" fieldId="fcm_key" :fieldLabel="__('restapi::app.fcmKey')"
                                           fieldRequired="true">
                            </x-forms.label>
                            <x-forms.input-group>
                                <input type="password" name="fcm_key" id="fcm_key" class="form-control height-35 f-14"
                                       value="{{ $restAPISetting->fcm_key }}">

                                <x-slot name="preappend">
                                    <button type="button" data-toggle="tooltip"
                                            data-original-title="Click Here to View Key"
                                            class="btn btn-outline-secondary border-grey height-35 toggle-password"><i
                                            class="fa fa-eye"></i></button>
                                </x-slot>
                            </x-forms.input-group>
                        </div>
                    </div>

                </div>

                <x-slot name="action">
                    <!-- Buttons Start -->
                    <div class="w-100 border-top-grey">
                        <div class="settings-btns py-3 d-none d-lg-flex d-md-flex justify-content-end px-4">
                            <x-forms.button-cancel :link="url()->previous()" class="border-0 mr-3">@lang('app.cancel')
                            </x-forms.button-cancel>

                            <x-forms.button-primary id="save-form"
                                                    icon="check">@lang('app.save')</x-forms.button-primary>
                        </div>
                        <div class="d-block d-lg-none d-md-none p-4">
                            <div class="d-flex w-100">
                                <x-forms.button-primary class="mr-3 w-100" icon="check">@lang('app.save')
                                </x-forms.button-primary>
                            </div>
                            <x-forms.button-cancel :link="url()->previous()" class="w-100 mt-3">@lang('app.cancel')
                            </x-forms.button-cancel>
                        </div>
                    </div>
                    <!-- Buttons End -->
                </x-slot>
            @endif

        </x-setting-card>

    </div>
    <!-- SETTINGS END -->
@endsection

@push('scripts')
    <script>

        $('#testAndroidPushNotification').click(function () {
            const url = "{{ route('rest-api.test_push', 'android') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('#testIOSPushNotification').click(function () {
            const url = "{{ route('rest-api.test_push', 'ios') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('#save-form').click(function () {
            const url = "{{ route('rest-api-setting.update', ['1']) }}";

            $.easyAjax({
                url: url,
                container: '#editSettings',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#save-form",
                data: $('#editSettings').serialize(),
            })
        });

    </script>
@endpush
