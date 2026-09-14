<x-auth>
    <div id="login-form">
        <h3 class="mb-4 f-w-500">@lang('app.login')</h3>

        <a href="{{ route('social_login', 'keycloak') }}" class="mb-3 height_50 rounded f-w-500">
            <span><i class="fa fa-shield-alt" style="font-size: 18px;"></i></span>
            @lang('auth.signInKeycloak')
        </a>
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
