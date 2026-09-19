{{-- The 2FA changes that run once identity has been confirmed, either with the
     local password in the confirm modal or through the SSO round-trip. --}}
<script>
    window.runConfirmedTwoFaAction = function(method, status, container) {
        if (method === 'recovery_codes') {
            regenerateRecoveryCodes(container);

            return;
        }

        changeFortifySettings(method, status, container);
    };

    function regenerateRecoveryCodes(container) {
        $.easyAjax({
            url: "/user/two-factor-recovery-codes",
            type: "POST",
            blockUI: true,
            container: container,
            data: {
                '_token': "{{ csrf_token() }}"
            },
            success: function(response) {
                window.location.reload();
            }
        });
    }

    function changeFortifySettings(method, status, container) {
        let url = "{{ route('two-fa-settings.update', '1') }}";
        let token = "{{ csrf_token() }}";

        $.easyAjax({
            url: url,
            type: "POST",
            blockUI: true,
            container: container,
            data: {
                '_token': token,
                '_method': 'put',
                'method': method,
                'status': status
            },
            success: function(response) {
                if (method == 'google_authenticator') {
                    changeFortifyStatus(status, container);
                } else {
                    window.location.reload();
                }
            }
        });
    }

    function changeFortifyStatus(type, container) {
        let url = "{{ route('two-factor.enable') }}";
        let method = (type) == 'disable' ? 'DELETE' : 'POST';
        let token = "{{ csrf_token() }}";

        $.easyAjax({
            url: url,
            type: "POST",
            blockUI: true,
            container: container,
            data: {
                '_token': token,
                '_method': method
            },
            success: function(response) {
                window.location.reload();
            }
        });
    }
</script>
