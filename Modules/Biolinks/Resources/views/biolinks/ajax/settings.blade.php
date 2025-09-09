@push('styles')
    <link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-colorpicker.css') }}"/>
    <link rel="stylesheet" href="{{ asset('vendor/css/tagify.css') }}">

    <style>
        /* Radio buttons start */
        .module-list li {
            float: left;
            margin: 0 5px 0 0;
            width: 30%;
            height: 40px;
            position: relative;
        }

        .module-list label,
        .module-list input {
            display: block;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
        }

        .module-list input[type="radio"] {
            opacity: 0.01;
            z-index: 100;
        }

        .module-list input[type="radio"]:checked + label,
        .Checked + label {
            border: 2px solid #1d82f5;
        }

        .module-list input[type="radio"]:checked + label .list-icon,
        .Checked + label .list-icon {
            color: #1d82f5;
        }

        .module-list label {
            padding: 5px;
            border: 1px solid #CCC;
            cursor: pointer;
            z-index: 90;
        }

        .module-list label:hover {
            border: 2px solid #1d82f5;

        }

        .list-icon :hover {
            border: 2px solid #1d82f5;
        }

        .module-list li label {
            font-weight: 400;
            font-size: 14px;
        }

        .font-family-btn {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 27ch;
        }

        /* Radio buttons end */

        /* Ace Editor */
        #css-editor {
            height: 300px;
        }

        #js-editor {
            height: 300px;
        }

        .ace_gutter {
            z-index: auto;
        }

        /* colorpicker */
        #colorpicker .form-group {
            width: 100%;
        }
    </style>

    @if ($biolinkSettings->theme_color)
        <style>
            iframe {
                background: {{ $biolinkSettings->theme_color }};
            }
        </style>
    @else
        <style>
            iframe {
                background: linear-gradient(to bottom, #ff758c, #ff7eb3);
            }
        </style>
    @endif
@endpush

<!-- CONTENT WRAPPER START -->
<div class="invoice-table-wrapper">
    <div class="row">
        <div class="col-md-12">
            <div class="row">
                <div class="col-md-12 ntfcn-tab-content-left w-100">
                    <x-form id="save-biolink-setting-form" method="PUT">
                        <input type="hidden" value="{{ $biolinkSettings->id }}" id="biolink-setting-id"
                               name="biolink-setting-id">
                        <div class="accordion" id="accordionExample">

                            @foreach (\Modules\Biolinks\Enums\SettingTab::cases() as $key => $tab)
                                <div class="card">
                                    <div class="card-header" id="heading{{ $key }}">
                                        <h2 class="mb-0">
                                            <button
                                                class="btn btn-block text-left text-black d-flex justify-content-between align-items-center"
                                                type="button" data-toggle="collapse"
                                                data-target="#collapse{{ $key }}" aria-expanded="true"
                                                aria-controls="collapse{{ $key }}">
                                                <span>{{ $tab->label() }}</span>
                                                <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none"
                                                     xmlns="http://www.w3.org/2000/svg">
                                                    <path fill-rule="evenodd" clip-rule="evenodd"
                                                          d="M18.5303 9.46967C18.8232 9.76256 18.8232 10.2374 18.5303 10.5303L12.5303 16.5303C12.2374 16.8232 11.7626 16.8232 11.4697 16.5303L5.46967 10.5303C5.17678 10.2374 5.17678 9.76256 5.46967 9.46967C5.76256 9.17678 6.23744 9.17678 6.53033 9.46967L12 14.9393L17.4697 9.46967C17.7626 9.17678 18.2374 9.17678 18.5303 9.46967Z"
                                                          fill="#030D45"/>
                                                </svg>
                                            </button>
                                        </h2>
                                    </div>

                                    <div id="collapse{{ $key }}" class="collapse @if ($key == 0) show @endif"
                                         aria-labelledby="heading{{ $key }}" data-parent="#accordionExample">
                                        <div class="card-body">

                                            @if ($tab->label() == 'Background')
                                                @include('biolinks::biolink-settings.background')
                                            @endif

                                            @if ($tab->label() == 'Verified badge')
                                                @include('biolinks::biolink-settings.verified-badge')
                                            @endif

                                            @if ($tab->label() == 'Branding')
                                                @include('biolinks::biolink-settings.branding')
                                            @endif

                                            @if ($tab->label() == 'Protection')
                                                @include('biolinks::biolink-settings.protection')
                                            @endif

                                            @if ($tab->label() == 'Seo')
                                                @include('biolinks::biolink-settings.seo')
                                            @endif

                                            {{-- @if ($tab->label() == 'Advanced')
                                                @include('biolinks::biolink-settings.advanced')
                                            @endif --}}

                                        </div>
                                    </div>
                                </div>
                            @endforeach

                        </div>
                    </x-form>
                </div>
                <div class="col-md-12 mt-3 mb-3">
                    <div class="row">
                        <x-form-actions>
                            <x-forms.button-primary id="save-biolink-setting" class=""
                                                    icon="check">@lang('app.save')
                            </x-forms.button-primary>
                        </x-form-actions>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<!-- CONTENT WRAPPER END -->

@push('scripts')
    <script src="{{ asset('vendor/jquery/bootstrap-colorpicker.js') }}"></script>
    <script src="{{ asset('vendor/jquery/tagify.min.js') }}"></script>

    @if ($biolinkSettings->branding_text_color)
        <script>
            let brandingTextColor = "{{ $biolinkSettings->branding_text_color }}";

            $('#colorpicker').colorpicker({
                "color": brandingTextColor
            });
        </script>
    @else
        <script>
            $('#colorpicker').colorpicker({
                "color": '#0B0C0B'
            });
        </script>
    @endif

    @if ($biolinkSettings->custom_color_one)
        <script>
            let colorOne = "{{ $biolinkSettings->custom_color_one }}";

            $('#colorpicker-one').colorpicker({
                "color": colorOne,
            });
        </script>
    @else
        <script>
            $('#colorpicker-one').colorpicker({
                "color": '#7EE7F9'
            });
        </script>
    @endif

    @if ($biolinkSettings->custom_color_two)
        <script>
            let colorTwo = "{{ $biolinkSettings->custom_color_two }}";

            $('#colorpicker-two').colorpicker({
                "color": colorTwo,
            });
        </script>
    @else
        <script>
            $('#colorpicker-two').colorpicker({
                "color": '#0B0C0B'
            });
        </script>
    @endif

    <script>
        var input = document.querySelector('input[name=meta_keywords]'),
            // init Tagify script on the above inputs
            tagify = new Tagify(input);

        $("input[name='font']").on('click', function() {
            let font = $(this).val();

            let iframeFont = $('#livePreview').contents().find('body');
            let headingFont = $('#livePreview').contents().find('.heading-font');

            iframeFont.css('font-family', font);
            headingFont.css('font-family', font);
        });

        $("input[name='block_space']").on('click', function() {
            let blockSpace = $(this).val();
            let iframeblockSpace = $('#livePreview').contents().find('.blocks-div');
            iframeblockSpace.css('gap', blockSpace == 'large' ? '30px' : (blockSpace == 'medium' ? '20px' : '10px'));
        });

        $('#branding_name').on('input', function () {
            let brandingName = $('#branding_name').val();
            let brandingUrl = $('#livePreview').contents().find('#branding-url');

            brandingUrl.text(brandingName);
        });

        function updateBrandingColor() {
            let color = $('#branding_text_color').val();

            let brandingDiv = $('#livePreview').contents().find('#branding-url');
            brandingDiv.css('color', color);
        }

        $('#branding_text_color').on('change', function () {
            updateBrandingColor();
        });

        $('.verified_badge').on('click', function() {
            let position = $(this).val();

            let badgeDiv = $('#livePreview').contents().find('.blocks-div');
            let badgeSpan = badgeDiv.find('#verified-badge');

            if (position == 'top') {
                badgeSpan.css({'display': 'block', 'top': '10px', 'bottom': ''});
                badgeDiv.css({'display': 'block', 'margin-top': '40px'});
            } else if (position == 'bottom') {
                badgeSpan.css({'display': 'block', 'bottom': '10px', 'top': ''});
                badgeDiv.css({'display': 'block', 'margin-top': '20px'});
            } else {
                badgeSpan.css('display', 'none');
                badgeDiv.css('margin-top', '20px');

            }
        });

        $("input[name='theme']").on('click', function() {

            let theme = $(this).val();
            // let iframeDocs = $('#livePreview').contents().find('body');
            let iframeDocs = $('#livePreview');

            if (theme == 'MonoChrome') {
                iframeDocs.css('background', 'linear-gradient(135deg, #ffffff 10%, #000000 100%)');

                $('#theme_color').val('linear-gradient(135deg, #ffffff 10%, #000000 100%)');
                $("#colorpicker-one, #colorpicker-two").addClass('d-none');
            } else if (theme == 'Gradienta') {
                iframeDocs.css('background', 'linear-gradient(to bottom, #ff758c, #ff7eb3)');

                $('#theme_color').val('linear-gradient(to bottom, #ff758c, #ff7eb3)');
                $("#colorpicker-one, #colorpicker-two").addClass('d-none');
            } else if (theme == 'Custom') {

                $("#colorpicker-one, #colorpicker-two").removeClass('d-none');
                updatecustomColor();
            } else {
                iframeDocs.css('background', 'linear-gradient(to bottom, #ff758c, #ff7eb3)');

                $('#theme_color').val('linear-gradient(to bottom, #ff758c, #ff7eb3)');
                $("#colorpicker-one, #colorpicker-two").addClass('d-none');
            }
        });

        $('#custom_color_one, #custom_color_two').on('change', function() {
            updatecustomColor();
        });

        function updatecustomColor() {

            let colorOne = $('#custom_color_one').val();
            let colorTwo = $('#custom_color_two').val();

            let iframeDocs = $('#livePreview');
            // let iframeDocs = $('#livePreview').contents().find('body');
            iframeDocs.css('background', 'linear-gradient(to bottom, ' + colorOne + ', ' + colorTwo + ')');

            $('#theme_color').val('linear-gradient(to bottom, ' + colorOne + ', ' + colorTwo + ')');
        }

        /* let editor = ace.edit("css-editor");
        editor.setTheme("ace/theme/monokai");
        editor.getSession().setMode("ace/mode/css");
        editor.getSession().on('change', function () {
            let code = editor.getValue();
            $('#custom-css').val(code);
        });

        let jsEditor = ace.edit("js-editor");
        jsEditor.setTheme("ace/theme/monokai");
        jsEditor.getSession().setMode("ace/mode/javascript");
        jsEditor.getSession().on('change', function () {
            let jsCode = jsEditor.getValue();
            $('#custom-js').val(jsCode);
        }); */

        $('#save-biolink-setting').on('click', function() {

            let id = $('#biolink-setting-id').val();
            let url = "{{ route('biolink-settings.update', ':id') }}";
            url = url.replace(':id', id);
            let data = $('#save-biolink-setting-form').serialize();

            $.easyAjax({
                url: url,
                container: '#save-biolink-setting-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: '#save-biolink-setting',
                file: true,
                data: data,
                success: function (response) {
                    if (response.status == 'success') {
                        //
                    }
                }
            });
        });
    </script>
@endpush
