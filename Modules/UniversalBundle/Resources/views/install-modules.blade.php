@if(count(getUniversalBundleAvailableForInstallModules()) > 0)
<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 px-0 pb-4">
    <h4 class="f-21 font-weight-normal">
        @lang('universalbundle::app.installBundleModules')
    </h4>

</div>
<div class="col-md-12 mb-3 px-0">
    <ul class="list-group" id="files-list">
        @foreach (getUniversalBundleAvailableForInstallModules() as $module)
        <li class="list-group-item">
            <div class="row">
                <div class="col-lg-9 py-1">
                    <b>{{ $module }}</b>
                </div>


                <div class="col-lg-3 text-lg-right py-1">
                    <button type="button"
                            class="btn btn-primary p-1 f-13 btn-sm mr-2 installUniversalBundleModule"
                            data-module="{{ $module }}">@lang('modules.update.install') <i
                            class="fa fa-download"></i>
                    </button>
                </div>
            </div>
        </li>

        @endforeach
    </ul>
</div>

<script>
$('body').on('click', '.installUniversalBundleModule', function() {
        var module = $(this).data('module');


        var alertMessage = `@lang('universalbundle::app.installModuleConfirm', ['module' => ':module'])`;
        alertMessage = alertMessage.replace(':module', module);

        Swal.fire({
            title: "@lang('messages.sweetAlertTitle')",
            text: alertMessage,
            icon: 'warning',
            showCancelButton: true,
            focusConfirm: false,
            confirmButtonText: "@lang('app.yes')",
            cancelButtonText: "@lang('app.cancel')",
            customClass: {
                confirmButton: 'btn btn-primary mr-3',
                cancelButton: 'btn btn-secondary'
            },
            showClass: {
                popup: 'swal2-noanimation',
                backdrop: 'swal2-noanimation'
            },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {

                var url = "{{ route('install-universal-bundle-module') }}";

                var token = "{{ csrf_token() }}";

                $.easyAjax({
                    type: 'POST',
                    url: url,
                    data: {
                        '_token': token,
                        'module': module,
                    },
                    blockUI: true,
                    success: function(response) {
                        if (response.status == 'success') {
                            $.easyAjax({
                                type: 'POST',
                                url: "{{ route('add-universal-module-purchase-code') }}",
                                data: {
                                    '_token': token,
                                    'module': module,
                                },
                                blockUI: true,
                                success: function(response) {
                                    if (response.status == 'success') {
                                        setTimeout(() => {
                                            $.unblockUI();
                                            window.location.reload();
                                        }, 2000);
                                    }
                                }
                            });
                        }
                    }
                });
            }
        });
    });

</script>
@endif
