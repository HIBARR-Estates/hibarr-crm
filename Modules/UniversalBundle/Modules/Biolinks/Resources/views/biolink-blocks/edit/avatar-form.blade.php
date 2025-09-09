<x-form id="edit-block-{{ $tab->id }}" method="PUT" data-block-id="{{ $tab->id }}" class="ajax-form">
    <input type="hidden" name="type" value="avatar">

    <div class="col-md-12">
        <x-forms.file allowedFileExtensions="png jpg jpeg svg bmp" class="mr-0 mr-lg-2 mr-md-2 cropper block-update" data-html-type="attr" data-attrname="src"
                      :fieldLabel="__('validation.attributes.image')" fieldName="image" fieldId="image"
                      :fieldValue="$tab->file_url" :fieldRequired="true"
                      fieldHeight="70" />
    </div>

    <div class="col-sm-12">
        <x-forms.url fieldId="url-{{ $tab->id }}" :fieldLabel="__('app.url')" fieldName="url" fieldValue="{{ $tab->url }}"
                    fieldRequired="false" :fieldPlaceholder="__('placeholders.website')">
        </x-forms.url>
    </div>

    <div class="col-sm-12">
        <x-forms.text fieldId="image-alt-{{ $tab->id }}" :fieldLabel="__('biolinks::app.imageAlt')" fieldName="image_alt" fieldValue="{{ $tab->image_alt }}"
                      fieldRequired="false" :fieldPlaceholder="__('placeholders.name')">
        </x-forms.text>
    </div>

    <div class="col-sm-12 form-group">
        <x-forms.label fieldId="avatar-size" class="my-3" :fieldLabel="__('biolinks::app.avatarSize')" fieldRequired="true">
        </x-forms.label>
        <select class="form-control select-picker avatar-size block-update" data-live-search="true" data-size="8" name="avatar_size"  data-html-type="css" data-attrname="height"
            id="avatar-size">
            @foreach (\Modules\Biolinks\Enums\AvatarSize::cases() as $avatarSize)
                <option value="{{ $avatarSize->value }}" @selected($avatarSize == $tab->avatar_size)>{{ $avatarSize->value . 'X' . $avatarSize->value }}
                </option>
            @endforeach
        </select>
    </div>

    <div class="col-sm-12 form-group">
        <x-forms.label fieldId="object-fit-{{ $tab->id }}" class="my-3" :fieldLabel="__('biolinks::app.objectFit')">
        </x-forms.label>
        <select class="form-control select-picker block-update" data-live-search="true" data-size="8" name="object_fit" data-html-type="css" data-attrname="object-fit"
            id="object-fit-{{ $tab->id }}">
            @foreach (\Modules\Biolinks\Enums\ObjectFit::cases() as $object)
                <option value="{{ $object->value }}" @selected($object == $tab->object_fit)>{{ $object->label() }}
                </option>
            @endforeach
        </select>
    </div>

    <div class="custom-control custom-switch ml-3 col-sm-6 my-3">
        <!-- Hidden input field to hold the checkbox state -->
        <input type="hidden" name="open_in_new_tab" id="open-in-new-tab-{{ $tab->id }}" value="{{ $tab->open_in_new_tab }}">

        <!-- Checkbox -->
        <input type="checkbox"
               @if ($tab->open_in_new_tab == '1') checked @endif
               class="cursor-pointer custom-control-input change-module-setting"
               id="new-tab-{{ $tab->id }}" name="open_in_new_tab_checkbox"
        >
        <label class="custom-control-label cursor-pointer" for="new-tab-{{ $tab->id }}">@lang('biolinks::app.openInNewTab')</label>
    </div>

    {{-- BORDER SETTING START --}}

    <div class="col-sm-12 my-3">
        <x-alert type="warning" icon="info-circle">@lang('biolinks::app.borderSettings')</x-alert>
    </div>

    <div class="col-sm-12">
        <x-forms.range class="mr-0 mr-lg-2 mr-md-2 block-update" data-html-type="css" data-attrname="border-width"
            :fieldLabel="__('biolinks::app.borderwidth')" fieldName="border_width" :max="5"
            fieldId="border_width-{{ $tab->id }}" :fieldValue="$tab->border_width" fieldHelp="in px"/>
    </div>

    <div class="col-sm-12">
        <div id="colorpicker">
            <div class="my-3 text-left form-group color-picker block-update" data-html-type="css" data-attrname="border-color">
                <x-forms.label fieldId="border-color-{{ $tab->id }}" :fieldLabel="__('biolinks::app.borderColor')"
                    fieldRequired="false">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="text" name="border_color" id="border-color-{{ $tab->id }}" value="{{ $tab->border_color }}"
                        class="form-control height-35 f-15 light_text">
                    <x-slot name="append">
                        <span class="input-group-text colorpicker-input-addon height-35"><i></i></span>
                    </x-slot>
                </x-forms.input-group>
            </div>
        </div>
    </div>

    <div class="col-sm-12">
        <x-forms.label fieldId="border-radius" :fieldLabel="__('biolinks::app.borderRadius')" fieldRequired="true"></x-forms.label>

        <div>
            <ul class="module-list list-unstyled block-update" data-html-type="css" data-attrname="border-radius">
                @foreach (\Modules\Biolinks\Enums\BorderRadius::cases() as $key => $border_radi)
                    <li>
                        <input type="radio" id="border-radius-{{ $tab->id }}-{{ $key }}"
                            value="{{ $border_radi->value }}" name="border_radius" @checked($border_radi == $tab->border_radius)/>
                        <label class="btn" for="border-radius-{{ $tab->id }}-{{ $key }}"> {{ $border_radi->label() }} </label>
                    </li>
                @endforeach
            </ul>
        </div>
    </div>

    <div class="col-sm-12 mt-6">
        <x-forms.label fieldId="align-text" :fieldLabel="__('biolinks::app.borderStyle')"></x-forms.label>

        <div>
            <ul class="module-list list-unstyled block-update" data-html-type="css" data-attrname="border-style">
                @foreach (\Modules\Biolinks\Enums\BorderStyle::cases() as $key => $border_style)
                    <li>
                        <input type="radio" id="border-style-{{ $tab->id }}-{{ $key }}"
                            value="{{ $border_style->value }}" name="border_style" @checked($border_style == $tab->border_style)/>
                        <label class="btn" for="border-style-{{ $tab->id }}-{{ $key }}"> {{ $border_style->label() }} </label>
                    </li>
                @endforeach
            </ul>
        </div>
    </div>
    {{-- BORDER SETTING END --}}

    {{-- BORDER SHADOW SETTING START --}}

    <div class="col-sm-12  mt-100">
        <x-alert type="warning" icon="info-circle">@lang('biolinks::app.borderShadowSettings')</x-alert>
    </div>

    <div class="col-sm-12">
        <x-forms.range class="mr-0 mr-lg-2 mr-md-2 block-update"
            :fieldLabel="__('biolinks::app.borderShadowX')" fieldName="border_shadow_x" :max="20" :min="-20" data-html-type="css" data-attrname="box-shadow"
            fieldId="border-shadow-x-{{ $tab->id }}" :fieldValue="$tab->border_shadow_x" fieldHelp="in px"/>
    </div>
    <div class="col-sm-12">
        <x-forms.range class="mr-0 mr-lg-2 mr-md-2 block-update"
            :fieldLabel="__('biolinks::app.borderShadowY')" fieldName="border_shadow_y" :max="20" :min="-20" data-html-type="css" data-attrname="box-shadow"
            fieldId="border-shadow-y-{{ $tab->id }}" :fieldValue="$tab->border_shadow_y" fieldHelp="in px"/>
    </div>
    <div class="col-sm-12">
        <x-forms.range class="mr-0 mr-lg-2 mr-md-2 block-update"
            :fieldLabel="__('biolinks::app.borderShadowBlur')" fieldName="border_shadow_blur" :max="20" data-html-type="css" data-attrname="box-shadow"
            fieldId="border-shadow-blur-{{ $tab->id }}" :fieldValue="$tab->border_shadow_blur" fieldHelp="in px"/>
    </div>
    <div class="col-sm-12">
        <x-forms.range class="mr-0 mr-lg-2 mr-md-2 block-update"
            :fieldLabel="__('biolinks::app.borderShadowSpread')" fieldName="border_shadow_spread" :max="10" data-html-type="css" data-attrname="box-shadow"
            fieldId="border-shadow-spread-{{ $tab->id }}" :fieldValue="$tab->border_shadow_spread" fieldHelp="in px"/>
    </div>

    <div class="col-sm-12">
        <div id="colorpicker">
            <div class="my-3 text-left form-group color-picker block-update" data-html-type="css" data-attrname="box-shadow">
                <x-forms.label fieldId="border-shadow-color-{{ $tab->id }}" :fieldLabel="__('biolinks::app.borderShadowColor')"
                    fieldRequired="false">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="text" name="border_shadow_color" id="border-shadow-color-{{ $tab->id }}" value="{{ $tab->border_shadow_color }}"
                        class="form-control height-35 f-15 light_text">
                    <x-slot name="append">
                        <span class="input-group-text colorpicker-input-addon height-35"><i></i></span>
                    </x-slot>
                </x-forms.input-group>
            </div>
        </div>
    </div>

    {{-- BORDER SHADOW SETTING END --}}

    <div class="pl-3">
        <x-forms.button-primary id="save-block-{{ $tab->id }}" data-block-id="{{ $tab->id }}" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>

</x-form>

<script>
    $('#new-tab-{{ $tab->id }}').on('change', function() {
        $('#open-in-new-tab-{{ $tab->id }}').val(this.checked ? '1' : '0');
    });

    $('#save-block-{{ $tab->id }}').on('click', function () {
        var blockId = $(this).data('block-id');

        var url = "{{ route('biolink-blocks.update', [':blockId']) }}";
        url = url.replace(':blockId', blockId);
        $.easyAjax({
            url: url,
            container: '#edit-block-'+blockId,
            type: "POST",
            data: $('#edit-block-'+blockId).serialize(),
            disableButton: true,
            blockUI: true,
            file: true,
            buttonSelector: "#save-block-"+blockId,
            success: function (response) {
                if (response.status == 'success') {
                }
            }
        })
    });
</script>
