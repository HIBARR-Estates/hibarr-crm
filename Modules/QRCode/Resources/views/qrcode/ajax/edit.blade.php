<style>
    .qr-preview-container .spinner-border {
        border: 0.25em solid var(--header_color);
        border-right: 0.25em solid transparent;
    }
</style>
<div class="row">
    <div class="col-sm-12">
        <x-form id="save-qrcode-data-form">
            <input type="hidden" name="qrId" value="{{ $qrCodeData->id }}">
            <div class="add-qrcode bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                    @lang('qrcode::app.editQrCode')</h4>

                <div class="row p-20">
                    <div class="col-lg-9">
                        <div class="row">
                            <div class="col-md-6">
                                <x-forms.text :fieldLabel="__('qrcode::app.fields.qrTitle')" fieldName="qrTitle" fieldId="qrTitle" :fieldRequired="true" :fieldValue="$qrCodeData->title"/>
                            </div>

                            <div class="col-lg-6">
                                <x-forms.select fieldId="type" :fieldLabel="__('qrcode::app.fields.type')" fieldName="type" search="true" fieldRequired="true">
                                    @foreach (\Modules\QRCode\Enums\Type::cases() as $type)
                                        <option @selected($type == $qrCodeData->type) value="{{ $type->value }}" data-content="{{ $type->labelWithIcon() }}">{{ $type->label() }}</option>
                                    @endforeach
                                </x-forms.select>
                            </div>

                        </div>
                        <div class="row" id="qr-fields">
                            @include('qrcode::qrcode.fields.'.$qrCodeData->type->value)
                        </div>
                    </div>
                    <div class="col-lg-3 p-0 qr-preview-container">
                        <div class="card d-flex justify-content-center w-100 qr-preview">
                            @include('qrcode::qrcode.qr-placeholder')
                            <img src="{{ $qr }}" class="w-100">
                        </div>
                        <button type="button" class="btn-primary rounded f-14 p-2 mr-3 mt-2 w-100 generate-qr">
                            @lang('qrcode::app.generateQrPreview')
                        </button>
                    </div>

                </div>

                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-top-grey">
                    <a href="javascript:;" class="text-dark toggle-qr-logo"><i class="fa fa-chevron-down"></i>
                        @lang('qrcode::app.fields.logo')
                    </a>
                </h4>


                <div class="row px-4 d-none" id="qr-logo">
                    <div class="col-lg-12">
                        <x-forms.file allowedFileExtensions="png jpg jpeg svg bmp" class="mr-0 mr-lg-2 mr-md-2 cropper"
                                      :fieldLabel="__('qrcode::app.fields.logo')" fieldName="logo" fieldId="logo"
                                      :fieldValue="$qrCodeData->logo_url"
                                      fieldHeight="100" />
                    </div>
                    <div class="col-lg-12">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="logo_size" :fieldLabel="__('qrcode::app.fields.logo_size')"  fieldRequired="true"/>

                            <input type="range" class="form-control-range" id="logo_size" value="{{ $qrCodeData->logo_size ?? 100 }}" name="logo_size" min="30"
                            onInput="$('#logo_size-val').html($(this).val() + '%')">

                            <span class="badge badge-light" id="logo_size-val">{{ $qrCodeData->logo_size ?? 100 }}%</span>
                        </div>
                    </div>
                </div>

                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-top-grey">
                    <a href="javascript:;" class="text-dark toggle-qr-logo-design"><i class="fa fa-chevron-down"></i>
                        @lang('qrcode::app.fields.design')
                    </a>
                </h4>


                <div class="row px-4 d-none" id="qr-logo-design">

                    <div class="col-lg-6">
                        <x-forms.number fieldId="size" :fieldLabel="__('qrcode::app.fields.size')" fieldName="size" fieldRequired="true" :fieldPlaceholder="__('qrcode::app.fields.size')" :fieldValue="$qrCodeData->size" minValue="200"/>
                    </div>

                    <div class="col-lg-6">
                        <x-forms.number fieldId="margin" :fieldLabel="__('qrcode::app.fields.margin')" fieldName="margin" fieldRequired="true" :fieldPlaceholder="__('qrcode::app.fields.margin')" :fieldValue="$qrCodeData->margin" minValue="10"/>
                    </div>

                    <div class="col-lg-6">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="colorselector" fieldRequired="true"
                                            :fieldLabel="__('qrcode::app.fields.background_color')">
                            </x-forms.label>
                            <x-forms.input-group class="color-picker">
                                <input type="text" class="form-control height-35 f-14"
                                        value="{{ $qrCodeData->background_color }}"
                                        placeholder="{{ __('placeholders.colorPicker') }}" name="background_color">

                                <x-slot name="append">
                                    <span class="input-group-text height-35 colorpicker-input-addon"><i></i></span>
                                </x-slot>
                            </x-forms.input-group>
                        </div>
                    </div>

                    <div class="col-lg-6">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="colorselector" fieldRequired="true"
                                            :fieldLabel="__('qrcode::app.fields.foreground_color')">
                            </x-forms.label>
                            <x-forms.input-group class="color-picker">
                                <input type="text" class="form-control height-35 f-14"
                                        value="{{ $qrCodeData->foreground_color }}"
                                        placeholder="{{ __('placeholders.colorPicker') }}" name="foreground_color">

                                <x-slot name="append">
                                    <span class="input-group-text height-35 colorpicker-input-addon"><i></i></span>
                                </x-slot>
                            </x-forms.input-group>
                        </div>
                    </div>

                    <div class="col-lg-12">
                        <x-alert type="warning" icon="info-circle">@lang('qrcode::app.qrGenerateWarning')</x-alert>
                    </div>
                </div>
                <x-form-actions>
                    <x-forms.button-primary id="save-qrcode-form" class="mr-3" icon="check"><span id="save-btn-text">@lang('app.update')</span>
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="route('qrcode.index')" class="border-0">@lang('app.cancel')
                    </x-forms.button-cancel>
                </x-form-actions>
            </div>
        </x-form>

    </div>
</div>
<script>
    $(document).ready(function() {
        $('.color-picker').colorpicker();

        $('.toggle-qr-logo').click(function() {
            $(this).find('svg').toggleClass('fa-chevron-down fa-chevron-up');
            $('#qr-logo').toggleClass('d-none');
        });

        $('.toggle-qr-logo-design').click(function() {
            $(this).find('svg').toggleClass('fa-chevron-down fa-chevron-up');
            $('#qr-logo-design').toggleClass('d-none');
        });

        $('body').on('change', '#type', function() {
            let type = $(this).val();
            let url = '{{ route('qrcode.fields', ':type') }}';
            url = url.replace(':type', type);
            $('.qr-preview img').attr('src', '');
            displayQrPlaceholder();

            $.easyAjax({
                url: url,
                type: 'GET',
                success: function (response) {
                    $('#qr-fields').html(response.view);
                    $('.select-picker').selectpicker('refresh');
                },
                complete: function () {
                    $.easyUnblockUI('.qr-preview');
                }
            })


        });

        $('body').on('click', '.generate-qr', function($e) {
            generateQr();
        });

        $('body').on('click', '#save-qrcode-form', function($e) {
            let form = $('#save-qrcode-data-form');
            clearFromErrors();

            $.easyAjax({
                url: '{{ route('qrcode.store') }}',
                type: 'POST',
                blockUI: true,
                container: '#save-qrcode-data-form',
                data: form.serialize(),
                file: true,
                success: function (response) {
                    setQrPerview(response.qr);
                    $('input[name="qrId"]').val(response.id);
                }
            });
        });

        function generateQr() {
            let form = $('#save-qrcode-data-form');
            clearFromErrors();
            displayQrPlaceholder();

            $.easyBlockUI('.qr-preview');

            $.easyAjax({
                url: '{{ route('qrcode.preview') }}',
                type: 'POST',
                container: '#save-qrcode-data-form',
                data: form.serialize(),
                file: true,
                success: function (response) {
                    setQrPerview(response.qr);
                },
                complete: function () {
                    $.easyUnblockUI('.qr-preview');
                }
            });
        }

        function setQrPerview(image) {
            $('.qr-preview img').attr('src', image);
            displayQr();
        }

        function clearFromErrors() {
            // Remove all errors
            $('#save-qrcode-data-form').find(".invalid-feedback").remove();
            $('#save-qrcode-data-form').find(".is-invalid").each(function () {
                $(this).removeClass("is-invalid");
            });
        }

        function displayQr() {
            $('.qr-preview img').removeClass('d-none');
            $('.qr-placeholder').addClass('d-none');
        }

        function displayQrPlaceholder() {
            $('.qr-preview img').addClass('d-none');
            $('.qr-placeholder').removeClass('d-none');
        }

        $('.qr-placeholder').addClass('d-none');
        init(RIGHT_MODAL);
    });
</script>
