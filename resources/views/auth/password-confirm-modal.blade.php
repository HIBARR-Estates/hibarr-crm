<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('app.authenticationRequired')</h5>
    <button type="button"  class="close" data-dismiss="modal" aria-label="Close"><span
            aria-hidden="true">×</span></button>
</div>
<div class="modal-body">
    <x-form id="reset-password-form" action="{{ route('password.confirm') }}" class="ajax-form" method="POST">
        <div class="row">
            <div class="col-lg-12">
                <x-forms.label class="mt-3" fieldId="password" :fieldLabel="__('modules.profile.yourPassword')">
                </x-forms.label>
                <x-forms.input-group>

                    <input type="password" name="password" id="password" autocomplete="off"
                        placeholder="@lang('placeholders.renterPassword')" class="form-control height-50 f-14">
                    <x-slot name="append">
                        <button type="button" data-toggle="tooltip" data-original-title="@lang('app.viewPassword')"
                            class="btn btn-outline-secondary border-grey height-50 toggle-password"><i
                                class="fa fa-eye"></i></button>
                    </x-slot>
                </x-forms.input-group>
            </div>
        </div>
        <input type="hidden" name="locale" value="{{ session()->has('locale') ? session('locale') : global_setting()->locale }}">
    </x-form>

    @if ($ssoProvider)
        {{-- SSO-only accounts may not know their local password, so let them
             re-authenticate with the provider they sign in with instead. --}}
        <div class="row mt-4">
            <div class="col-lg-12">
                <p class="f-14 text-dark-grey mb-2">@lang('messages.confirmWithSsoInfo')</p>
                <x-forms.link-secondary
                    :link="route('sso_confirm_password', ['method' => $method, 'status' => $status])"
                    class="height-50 f-14">
                    @lang('messages.confirmWithSso', ['provider' => $ssoProviderLabel])
                </x-forms.link-secondary>
            </div>
        </div>
    @endif
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
    <x-forms.button-primary id="submit-login" icon="check">@lang('app.confirmPassword')</x-forms.button-primary>
</div>

@include('auth.two-fa-actions')

<script>
    $('#submit-login').click(function() {

        var url = "{{ route('password.confirm') }}";
        $.easyAjax({
            url: url,
            container: '#reset-password-form',
            disableButton: true,
            blockUI: true,
            buttonSelector: "#submit-login",
            type: "POST",
            data: $('#reset-password-form').serialize(),
            success: function(response) {
                window.runConfirmedTwoFaAction('{{ $method }}', '{{ $status }}', '#reset-password-form');
            }
        })
    });
</script>
