<div class="p-4 col-lg-12 col-md-12 ntfcn-tab-content-left w-100 ">
    <div class="row" id="setting-row">

        <div class="p-20 row">
            @method('PUT')

            <div class="col-md-4">
                <x-forms.label class="mt-3" fieldId="account_id"
                               :fieldLabel="__('zoom::modules.zoomsetting.accountId')"
                               fieldRequired="true">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="password" name="account_id" id="account_id"
                           class="form-control height-35 f-14"
                           value="{{ $zoom->account_id ?? '' }}">
                    <x-slot name="preappend">
                        <button type="button" data-toggle="tooltip"
                                data-original-title="@lang('app.viewPassword')"
                                class="btn btn-outline-secondary border-grey height-35 toggle-password">
                            <i
                                class="fa fa-eye"></i></button>
                    </x-slot>
                </x-forms.input-group>
            </div>

            <div class="col-md-4">
                <x-forms.label class="mt-3" fieldId="api_key"
                               :fieldLabel="__('zoom::modules.zoomsetting.clientId')"
                               fieldRequired="true">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="password" name="api_key" id="api_key"
                           class="form-control height-35 f-14"
                           value="{{ $zoom->api_key ?? '' }}">
                    <x-slot name="preappend">
                        <button type="button" data-toggle="tooltip"
                                data-original-title="@lang('app.viewPassword')"
                                class="btn btn-outline-secondary border-grey height-35 toggle-password">
                            <i
                                class="fa fa-eye"></i></button>
                    </x-slot>
                </x-forms.input-group>
            </div>
            <div class="col-md-4">
                <x-forms.label class="mt-3" fieldId="secret_key"
                               :fieldLabel="__('zoom::modules.zoomsetting.clientSecret')"
                               fieldRequired="true">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="password" name="secret_key" id="secret_key"
                           class="form-control height-35 f-14" value="{{ $zoom->secret_key ?? '' }}">
                    <x-slot name="preappend">
                        <button type="button" data-toggle="tooltip"
                                data-original-title="@lang('app.viewPassword')"
                                class="btn btn-outline-secondary border-grey height-35 toggle-password">
                            <i
                                class="fa fa-eye"></i></button>
                    </x-slot>
                </x-forms.input-group>
            </div>

            <div class="col-md-4">
                <x-forms.label class="mt-3" fieldId="meeting_client_id"
                               :fieldLabel="__('zoom::modules.zoomsetting.meetingClientId')"
                               fieldRequired="true">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="password" name="meeting_client_id" id="meeting_client_id"
                           class="form-control height-35 f-14"
                           value="{{ $zoom->meeting_client_id ?? '' }}">
                    <x-slot name="preappend">
                        <button type="button" data-toggle="tooltip"
                                data-original-title="@lang('app.viewPassword')"
                                class="btn btn-outline-secondary border-grey height-35 toggle-password">
                            <i
                                class="fa fa-eye"></i></button>
                    </x-slot>
                </x-forms.input-group>
            </div>
            <div class="col-md-4">
                <x-forms.label class="mt-3" fieldId="meeting_client_secret"
                               :fieldLabel="__('zoom::modules.zoomsetting.meetingClientSecret')"
                               fieldRequired="true">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="password" name="meeting_client_secret" id="meeting_client_secret"
                           class="form-control height-35 f-14" value="{{ $zoom->meeting_client_secret ?? '' }}">
                    <x-slot name="preappend">
                        <button type="button" data-toggle="tooltip"
                                data-original-title="@lang('app.viewPassword')"
                                class="btn btn-outline-secondary border-grey height-35 toggle-password">
                            <i
                                class="fa fa-eye"></i></button>
                    </x-slot>
                </x-forms.input-group>
            </div>

            <div class="col-md-4">
                <x-forms.label class="mt-3" fieldId="secret_token"
                               :fieldLabel="__('zoom::modules.zoomsetting.secretToken')"
                               fieldRequired="true">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="password" name="secret_token" id="secret_token"
                           class="form-control height-35 f-14" value="{{ $zoom->secret_token ?? '' }}">
                    <x-slot name="preappend">
                        <button type="button" data-toggle="tooltip"
                                data-original-title="@lang('app.viewPassword')"
                                class="btn btn-outline-secondary border-grey height-35 toggle-password">
                            <i
                                class="fa fa-eye"></i></button>
                    </x-slot>
                </x-forms.input-group>
            </div>

            <div class="col-md-3">
                <div class="my-3 form-group">
                    <label class="mb-12 f-14 text-dark-grey w-100"
                           for="usr">@lang('zoom::modules.zoomsetting.openZoomApp')</label>
                    <div class="d-flex">
                        <x-forms.radio fieldId="zoom_app" :fieldLabel="__('app.yes')"
                                       fieldName="meeting_app" fieldValue="zoom_app"
                                       checked="($zoom->meeting_app == 'zoom_app')">
                        </x-forms.radio>
                        <x-forms.radio fieldId="in_app" :fieldLabel="__('app.no')" fieldValue="in_app"
                                       fieldName="meeting_app"
                                       :checked="($zoom->meeting_app == 'in_app')">
                        </x-forms.radio>
                    </div>
                </div>
            </div>

            <div class="mt-3 col-sm-12">
                <x-forms.label fieldId="" for="mail_from_name" :fieldLabel="__('app.webhook')">
                </x-forms.label>
                <p class="text-bold">
                    <span id="webhook-link-text">{{ $webhookRoute }}</span>
                    <a href="javascript:" class="p-1 py-2 ml-1 rounded btn-copy btn-secondary f-12"
                       data-clipboard-target="#webhook-link-text">
                        <i class="mx-1 fa fa-copy"></i>@lang('app.copy')</a>
                </p>
                <p class="text-primary">(@lang('zoom::modules.zoomsetting.webhookInfo'))</p>
            </div>


        </div>
        <x-form-actions>
            <x-forms.button-primary id="save_zoomSetting_form" icon="check">@lang('app.save')
            </x-forms.button-primary>
        </x-form-actions>

    </div>
</div>

@push('scripts')
    <script src="{{ asset('vendor/jquery/clipboard.min.js') }}"></script>
    <script>
        let CHANGE_DETECTED = false;
        $('.field').each(function () {
            let elem = $(this);
            CHANGE_DETECTED = false

            // Look for changes in the value
            elem.bind("change keyup paste", function () {
                CHANGE_DETECTED = true;
            });
        });
        var clipboard = new ClipboardJS('.btn-copy');
        clipboard.on('success', function () {
            Swal.fire({
                icon: 'success',
                text: '@lang("app.webhookUrlCopied")',
                toast: true,
                position: 'top-end',
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false,
                customClass: {
                    confirmButton: 'btn btn-primary',
                },
                showClass: {
                    popup: 'swal2-noanimation',
                    backdrop: 'swal2-noanimation'
                },
            })
        });

                $('body').on('click', '#save_zoomSetting_form', function () {
                    CHANGE_DETECTED = false;

                    const url = "{{ route('zoom-settings.update', $zoom->id) }}";
                    $.easyAjax({
                        url: url,
                        container: '#editSettings',
                        type: "POST",
                        blockUI: true,
                        data: $('#editSettings').serialize(),
                        success: function (response) {
                            if (response.status === 'error') {
                                $('#alert').prepend(
                                    '<div class="alert alert-danger">{{ __('messages.smtpError') }}</div>'
                                )
                            } else {
                                $('#alert').show();
                            }
                        }
                    })
                });
    </script>

@endpush
