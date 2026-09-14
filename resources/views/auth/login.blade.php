<x-auth>
    <div id="login-form">
        <h3 class="auth-title">@lang('auth.signIn')</h3>

        <a href="{{ route('social_login', 'keycloak') }}" class="auth-sso-btn">
            <span class="auth-sso-icon"><i class="fa fa-shield-alt"></i></span>
            @lang('auth.signInKeycloak')
        </a>

        <p class="auth-support">
            {!! __('auth.signInSupport', ['email' => '<a href="mailto:support@hibarr.de">support@hibarr.de</a>']) !!}
        </p>
    </div>

    <x-slot name="scripts">
        <script>
            @if (session('message'))
                Swal.fire({
                    icon: 'error',
                    text: '{{ session('message') }}',
                    showConfirmButton: true,
                    customClass: {
                        confirmButton: 'btn btn-primary',
                    },
                    showClass: {
                        popup: 'swal2-noanimation',
                        backdrop: 'swal2-noanimation'
                    },
                })
            @endif
        </script>
    </x-slot>

</x-auth>
