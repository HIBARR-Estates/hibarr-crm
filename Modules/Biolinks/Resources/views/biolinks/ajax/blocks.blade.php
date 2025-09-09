@push('styles')
    <!-- for sortable content -->
    <link rel="stylesheet" href="{{ asset('vendor/css/jquery-ui.css') }}">
    <style>
        .mt-100 {
            margin-top: 100px;
        }

        .mt-6 {
            margin-top: 4rem !important;
        }
    </style>
@endpush

<!-- CONTENT WRAPPER START -->
<div class="invoice-table-wrapper">
    <div class="row">
        <div class="col-md-12">
            <div class="row">

                <div class="col-md-12 ntfcn-tab-content-left w-100">
                    <div class="accordion" id="accordionExample1">
                        <div id="sortable">
                            @foreach ($blocks as $key => $tab)
                                <div class="card mt-2">
                                    <div class="card-header d-flex align-items-center justify-content-between"
                                        id="heading-{{ $tab->id }}">
                                        <div>
                                            <span class="ui-icon ui-icon-arrowthick-2-n-s"></span>
                                            <input type="hidden" name="sort_order[]" value="{{ $tab->id }}">
                                        </div>
                                        <div class="w-100">
                                            <h2 class="mb-0 d-flex justify-content-between">
                                                <button
                                                    class="text-left text-black btn btn-block d-flex justify-content-between align-items-center"
                                                    type="button" data-toggle="collapse"
                                                    data-target="#collapse{{ $key }}" aria-expanded="true"
                                                    aria-controls="collapse{{ $key }}">
                                                    @if ($tab->type == 'paragraph')
                                                        <span>{{ mb_strimwidth($tab->paragraph, 0, 40, "...") }}</span>
                                                    @else
                                                        <span>{{ mb_strimwidth($tab->name, 0, 40, "...") }}</span>
                                                    @endif

                                                    <button
                                                        class="btn btn-lg f-14 px-2 py-1 text-dark-grey  rounded  dropdown-toggle"
                                                        type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                        <i class="fa fa-ellipsis-h"></i>
                                                    </button>

                                                    <div class="dropdown-menu dropdown-menu-right border-grey rounded b-shadow-4 p-0"
                                                            aria-labelledby="dropdownMenuLink" tabindex="0">
                                                        <a class="dropdown-item" data-toggle="collapse"
                                                            data-target="#collapse{{ $key }}" aria-expanded="true"
                                                            aria-controls="collapse{{ $key }}"><i class="fa fa-edit mr-2"></i>@lang('app.edit')</a>
                                                        <a class="dropdown-item duplicateButton" id="duplicateButton" data-block-id="{{ $tab->id }}"
                                                            href="javascript:;"><i class="fa fa-clone mr-2"></i>@lang('app.duplicate')</a>
                                                        <hr class="my-1">
                                                        <a class="dropdown-item deleteBlock" id="deleteBlock" data-block-id="{{ $tab->id }}" href="javascript:;">
                                                            <i class="fa fa-trash mr-2"></i>@lang('app.delete')</a>
                                                    </div>

                                                </button>
                                            </h2>
                                        </div>
                                    </div>

                                    <div id="collapse{{ $key }}"
                                        class="collapse @if ($key == 0) show @endif"
                                        aria-labelledby="heading-{{ $key }}" data-parent="#accordionExample1">
                                        <div class="card-body">

                                            @if ($tab->type == 'link')
                                                @include('biolinks::biolink-blocks.edit.link-form')
                                            @endif

                                            @if ($tab->type == 'heading')
                                                @include('biolinks::biolink-blocks.edit.heading-form')
                                            @endif

                                            @if ($tab->type == 'paragraph')
                                                @include('biolinks::biolink-blocks.edit.paragraph-form')
                                            @endif

                                            @if ($tab->type == 'avatar')
                                                @include('biolinks::biolink-blocks.edit.avatar-form')
                                            @endif

                                            @if ($tab->type == 'image')
                                                @include('biolinks::biolink-blocks.edit.image-form')
                                            @endif

                                            @if ($tab->type == 'socials')
                                                @include('biolinks::biolink-blocks.edit.socials-form')
                                            @endif

                                            @if ($tab->type == 'email-collector')
                                                @include('biolinks::biolink-blocks.edit.email-collector-form')
                                            @endif

                                            @if ($tab->type == 'phone-collector')
                                                @include('biolinks::biolink-blocks.edit.phone-collector-form')
                                            @endif

                                            @if ($tab->type == 'paypal')
                                                @include('biolinks::biolink-blocks.edit.paypal-form')
                                            @endif

                                            @if (
                                                $tab->type == 'sound-cloud' ||
                                                    $tab->type == 'spotify' ||
                                                    $tab->type == 'youtube' ||
                                                    $tab->type == 'threads' ||
                                                    $tab->type == 'tiktok' ||
                                                    $tab->type == 'twitch')
                                                @include('biolinks::biolink-blocks.edit.embeds-form')
                                            @endif
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- CONTENT WRAPPER END -->

@push('scripts')
    <!-- for sortable content -->
    <script src="{{ asset('vendor/jquery/jquery-ui.min.js') }}"></script>

    <script>
        $(function() {
            $("#sortable").sortable({
                update: function(event, ui) {
                    var sortedValues = [];
                    $('input[name="sort_order[]"]').each(function(index, value) {
                        sortedValues[index] = $(this).val();
                    });
                    $.easyAjax({
                        url: "{{ route('biolink-blocks.sortFields') }}",
                        type: "POST",
                        blockUI: true,
                        data: {
                            'sortedValues': sortedValues,
                            '_token': '{{ csrf_token() }}'
                        },
                        success: function(response) {
                            iframePreview();
                        }
                    })
                }
            });
        });

        $('.color-picker').colorpicker();

        $("#dropify").dropify({
            messages: dropifyMessages
        });

        $('.block-update').on('change', function(event){
            let blockId = $(this).closest('.ajax-form').data('block-id');
            let blockType = $(this).closest('.ajax-form').find('[name="type"]').val();
            let key = $(this).data('html-type');
            let attrName = $(this).data('attrname');
            let attrVal = $(this).find('input').val();

            if (attrName == 'name'){
                return;
            }

            let iframeheading = $('#livePreview').contents().find(`[data-block-id="${blockId}"]`);

            if (attrName == 'text-align' || attrName == 'border-style' || attrName == 'border-radius'){
                attrVal = $(this).find('input:checked').val();
            }

            if (attrName == 'tagName'){
                attrVal = $(this).val();
                iframeheading.replaceWith(`<${attrVal} style="${iframeheading.attr('style')}" data-block-id="${blockId}">${iframeheading.text()}</${attrVal}>`);
                return;
            }

            if (attrName == 'border-radius'){
                iframeheading.removeClass('rounded rounded-0 rounded-pill rounded-20');
                if (blockType == 'paragraph'){
                    iframeheading.addClass( attrVal === 'round' ? 'rounded-20' : (attrVal === 'straight' ? 'rounded-0' : 'rounded'));
                }
                else{
                    iframeheading.addClass( attrVal === 'round' ? 'rounded-pill' : (attrVal === 'straight' ? 'rounded-0' : 'rounded'));
                }
            }

            if (attrName == 'box-shadow'){
                let $form = $(this).closest('.ajax-form');
                let borderOffsetX = $form.find('[name="border_shadow_x"]').val();
                let borderOffsetY = $form.find('[name="border_shadow_y"]').val();
                let borderBlur = $form.find('[name="border_shadow_blur"]').val();
                let borderSpread = $form.find('[name="border_shadow_spread"]').val();
                let borderShadowColor = $form.find('[name="border_shadow_color"]').val();

                attrVal = `${borderOffsetX}px ${borderOffsetY}px ${borderBlur}px ${borderSpread}px ${borderShadowColor}`;
            }

            if (attrName == 'height'){
                attrVal = $(this).val();
                iframeheading[key]('width', attrVal);
            }

            if (attrName == 'font-size'){
                attrVal = $(this).val();
                attrVal = attrVal == "extra large" ? 'x-large' : attrVal;
            }

            if (attrName == 'object-fit'){
                attrVal = $(this).val();
            }

            if (attrName == 'src'){
                attrVal = $(this).find('input').prop('files')[0];
                let reader = new FileReader();
                reader.onload = function(e) {
                    iframeheading[key](attrName, e.target.result);
                }
                reader.readAsDataURL(attrVal);
            }

            iframeheading[key](attrName, attrVal);

        })

        $('.block-update input, .block-update textarea').on('keyup', function(event){
            let blockId = $(this).closest('.ajax-form').data('block-id');
            let blockType = $(this).closest('.ajax-form').find('[name="type"]').val();
            let attrName = $(this).closest('.block-update').data('attrname');
            let key = $(this).closest('.block-update').data('html-type');
            let attrVal = $(this).val().replace(/(?:\r\n|\r|\n)/g, "<br>");

            let iframeheading = $('#livePreview').contents().find(`[data-block-id="${blockId}"]`);
            iframeheading[key](attrVal);

        })

        $('.deleteBlock').on('click',  function() {
            var blockId = $(this).data('block-id');

            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('messages.recoverRecord')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: "@lang('messages.confirmDelete')",
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
                    var url = "{{ route('biolink-blocks.destroy', ':id') }}";
                    url = url.replace(':id', blockId);

                    var token = "{{ csrf_token() }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        container: '#heading-' + blockId,
                        blockUI: true,
                        data: {
                            '_token': token,
                            '_method': 'DELETE'
                        },
                        success: function(response) {
                            if (response.status == "success") {
                                console.log($('#heading-' + blockId).parent());
                                $('#heading-' + blockId).parent().remove();
                                $('#livePreview').contents().find(`[data-block-id="${blockId}"]`).remove();
                            }
                        }
                    });
                }
            });
        });

        $('.duplicateButton').on('click', function() {
            var blockId = $(this).data('block-id');

            var url = "{{ route('biolink-blocks.duplicate', ':duplicateId') }}";
            url = url.replace(':duplicateId', blockId);

            var token = "{{ csrf_token() }}";

            $.easyAjax({
                type: 'POST',
                url: url,
                container: '#heading-' + blockId,
                blockUI: true,
                data: {
                    '_token': token,
                    '_method': 'GET'
                },
                success: function(response) {
                    if (response.status == "success") {
                        window.location.reload();
                    }
                }
            });
        });

    </script>
@endpush
