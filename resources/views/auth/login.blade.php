<x-auth>
    <div id="login-form">
        <h1 class="auth-title">@lang('auth.welcomeBack')</h1>
        <p class="auth-subtitle">@lang('auth.signInSubtitle')</p>

        <a href="{{ route('social_login', 'keycloak') }}" class="auth-sso-btn">
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
