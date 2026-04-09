<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-20">
    @method('PUT')

    <input type="hidden" name="tab" value="keycloak">
    <div class="row">
        <div class="col-lg-12 mb-4">
            <x-forms.checkbox :fieldLabel="__('app.status')" fieldName="keycloak_status" fieldId="keycloakButton"
                fieldValue="enable" fieldRequired="true" :checked="$credentials->keycloak_status == 'enable'" />
        </div>

        <div class="col-lg-12 keycloakSection mb-3 @if ($credentials->keycloak_status !== 'enable') d-none @endif">
            <div class="row">
                <div class="col-lg-6">
                    <x-forms.text :fieldLabel="__('app.socialAuthSettings.keycloakClientId')"
                        fieldName="keycloak_client_id" fieldRequired="true" fieldId="keycloak_client_id"
                        :fieldValue="$credentials->keycloak_client_id"></x-forms.text>
                </div>
                <div class="col-lg-6">
                    <div class="form-group">
                        <x-forms.label class="mt-3" fieldId="keycloak_secret_id" fieldRequired="true"
                            :fieldLabel="__('app.socialAuthSettings.keycloakSecret')">
                        </x-forms.label>
                        <x-forms.input-group>
                            <input type="password" name="keycloak_secret_id" id="keycloak_secret_id"
                                class="form-control height-35 f-14"
                                value="{{ $credentials->keycloak_secret_id }}">

                            <x-slot name="preappend">
                                <button type="button" data-toggle="tooltip"
                                    data-original-title="{{ __('messages.viewKey') }}"
                                    class="btn btn-outline-secondary border-grey height-35 toggle-password"><i
                                        class="fa fa-eye"></i></button>
                            </x-slot>
                        </x-forms.input-group>
                    </div>
                </div>
                <div class="col-lg-6">
                    <x-forms.text :fieldLabel="__('app.socialAuthSettings.keycloakBaseUrl')"
                        fieldName="keycloak_base_url" fieldRequired="true" fieldId="keycloak_base_url"
                        fieldPlaceholder="https://keycloak.example.com"
                        :fieldValue="$credentials->keycloak_base_url"></x-forms.text>
                </div>
                <div class="col-lg-6">
                    <x-forms.text :fieldLabel="__('app.socialAuthSettings.keycloakRealm')"
                        fieldName="keycloak_realm" fieldRequired="true" fieldId="keycloak_realm"
                        fieldPlaceholder="master"
                        :fieldValue="$credentials->keycloak_realm"></x-forms.text>
                </div>
                <div class="col-md-12">
                    <div class="form-group my-3">
                        <label for="keycloak_callback">@lang('app.callback')</label>
                        <p class="text-bold"><span
                                id="keycloak_webhook_link">{{ route('social_login_callback', 'keycloak') }}</span>
                            <a href="javascript:;" class="btn-copy btn-secondary f-12 rounded p-1 py-2 ml-1"
                                data-clipboard-target="#keycloak_webhook_link">
                                <i class="fa fa-copy mx-1"></i>@lang('app.copy')</a>
                        </p>
                        <p class="text-primary">(@lang('messages.addKeycloakCallback'))</p>
                    </div>
                </div>
            </div>
        </div>
        <!-- Buttons Start -->
        <div class="w-100 border-top-grey">
            <x-setting-form-actions>
                <x-forms.button-primary id="save_keycloak_data" class="mr-3" icon="check">@lang('app.save')
                </x-forms.button-primary>
            </x-setting-form-actions>
        </div>
        <!-- Buttons End -->
    </div>
</div>

<script>
    $('#keycloakButton').on('change', function() {
        $('.keycloakSection').toggleClass('d-none');
    });
</script>
