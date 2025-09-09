<x-form id="edit-block-{{ $tab->id }}" method="PUT" data-block-id="{{ $tab->id }}" class="ajax-form">
    <input type="hidden" name="type" value="email-collector">
    {{--  FORM SETTINGS START --}}
    <div class="col-sm-12 my-3">
        <x-alert type="warning" icon="info-circle">@lang('biolinks::app.formSettings')</x-alert>
    </div>

    <div class="col-sm-12">
        <x-forms.email fieldId="email_placeholder" :fieldLabel="__('biolinks::app.emailPlaceholder')" fieldName="email_placeholder" :fieldValue="$tab->placeholder"
             :fieldPlaceholder="__('placeholders.email')">
        </x-forms.email>
    </div>

    <div class="col-sm-12">
        <x-forms.text fieldId="name_placeholder-{{ $tab->id }}" :fieldLabel="__('biolinks::app.namePlaceholder')" fieldName="name_placeholder" fieldValue="{{ $tab->name_placeholder }}"
                      fieldRequired="false" :fieldPlaceholder="__('placeholders.name')">
        </x-forms.text>
    </div>

    <div class="col-sm-12">
        <x-forms.text fieldId="button_text-{{ $tab->id }}" :fieldLabel="__('biolinks::app.buttonText')" fieldName="button_text" fieldValue="{{ $tab->button_text }}"
                      fieldRequired="false" :fieldPlaceholder="__('app.signUp')">
        </x-forms.text>
    </div>

    <div class="col-sm-12">
        <x-forms.text fieldId="thank_you_message-{{ $tab->id }}" :fieldLabel="__('biolinks::app.thankyouMessage')" fieldName="thank_you_message" fieldValue="{{ $tab->thank_you_message }}"
                      fieldRequired="false" :fieldPlaceholder="__('placeholders.invoices.note')">
        </x-forms.text>
    </div>

    <div class="col-sm-12">
        <x-forms.url fieldId="thank_you_url-{{ $tab->id }}" :fieldLabel="__('biolinks::app.thankyouUrl')" fieldName="thank_you_url" fieldValue="{{ $tab->thank_you_url }}"
                    fieldRequired="false" :fieldPlaceholder="__('placeholders.website')">
        </x-forms.url>
    </div>

    <div class="custom-control custom-switch ml-3 col-sm-6">
        <!-- Hidden input field to hold the checkbox state -->
        <input type="hidden" name="show_agreement" id="show-agreement-{{ $tab->id }}" value="{{ $tab->show_agreement }}">

        <!-- Checkbox -->
        <input type="checkbox"
               @if ($tab->show_agreement == '1') checked @endif
               class="cursor-pointer custom-control-input change-module-setting"
               id="agreement-{{ $tab->id }}" name="show_agreement_checkbox"
        >
        <label class="custom-control-label cursor-pointer" for="agreement-{{ $tab->id }}">@lang('biolinks::app.showAgreement')</label>
    </div>

    <div class="col-sm-12">
        <x-forms.text fieldId="agreement_text-{{ $tab->id }}" :fieldLabel="__('biolinks::app.agreementText')" fieldName="agreement_text" fieldValue="{{ $tab->agreement_text }}"
                      fieldRequired="false" :fieldPlaceholder="__('placeholders.sampleText')">
        </x-forms.text>
    </div>

    <div class="col-sm-12">
        <x-forms.url fieldId="agreement_url-{{ $tab->id }}" :fieldLabel="__('biolinks::app.agreementUrl')" fieldName="agreement_url" fieldValue="{{ $tab->agreement_url }}"
                    fieldRequired="false" :fieldPlaceholder="__('placeholders.website')">
        </x-forms.url>
    </div>

    {{--  FORM SETTINGS END --}}

    {{-- DATA COLLECTION START --}}

    <div class="col-sm-12 my-3">
        <x-alert type="warning" icon="info-circle">@lang('biolinks::app.dataCollection')</x-alert>
    </div>

    <div class="col-sm-12">
        <x-forms.text fieldId="api_key-{{ $tab->id }}" :fieldLabel="__('biolinks::app.apiKey')" fieldName="api_key" fieldValue="{{ $tab->api_key }}"
                      fieldRequired="true" :fieldPlaceholder="__('placeholders.sampleText')">
        </x-forms.text>
    </div>

    <div class="col-sm-12">
        <x-forms.text fieldId="mailchimp_list-{{ $tab->id }}" :fieldLabel="__('biolinks::app.apiList')" fieldName="mailchimp_list" fieldValue="{{ $tab->mailchimp_list }}"
                      fieldRequired="true" :fieldPlaceholder="__('placeholders.sampleText')">
        </x-forms.text>
    </div>

    <div class="col-sm-12">
        <x-forms.email fieldId="email-{{ $tab->id }}" :fieldLabel="__('app.email')" fieldName="email" :fieldValue="$tab->email"
            fieldRequired="true" :fieldPlaceholder="__('placeholders.email')">
        </x-forms.email>
    </div>

    <div class="col-sm-12">
        {{-- <x-forms.url fieldId="webhook_url-{{ $tab->id }}" :fieldLabel="__('biolinks::app.webhookUrl')" fieldName="webhook_url" fieldValue="{{ $tab->webhook_url }}"
                      fieldRequired="false" :fieldPlaceholder="__('placeholders.url')">
        </x-forms.url> --}}
    </div>

    {{-- DATA COLLECTION END --}}

    {{-- CUSTOMIZATION SETTINGS START --}}

    <div class="col-sm-12 my-3">
        <x-alert type="warning" icon="info-circle">@lang('biolinks::app.customizationSettings')</x-alert>
    </div>

    <div class="col-sm-12">
        <x-forms.text fieldId="name-{{ $tab->id }}" :fieldLabel="__('app.name')" fieldName="name" fieldValue="{{ $tab->name }}" class="block-update" data-html-type="text" data-attrname="name"
                      fieldRequired="true" :fieldPlaceholder="__('placeholders.name')">
        </x-forms.text>
    </div>

    <div class="col-sm-12">
        <div id="colorpicker">
            <div class="my-3 text-left form-group color-picker block-update"  data-html-type="css" data-attrname="color">
                <x-forms.label fieldId="colorselector-{{ $tab->id }}" :fieldLabel="__('biolinks::app.textColor')"
                    fieldRequired="true">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="text" name="text_color" id="colorselector-{{ $tab->id }}" value="{{ $tab->text_color }}"
                        class="form-control height-35 f-15 light_text">
                    <x-slot name="append">
                        <span class="input-group-text colorpicker-input-addon height-35"><i></i></span>
                    </x-slot>
                </x-forms.input-group>
            </div>
        </div>
    </div>

    <div class="col-sm-12">
        <x-forms.label fieldId="align-text" :fieldLabel="__('biolinks::app.textAlign')"></x-forms.label>

        <div>
            <ul class="module-list list-unstyled block-update" data-html-type="css" data-attrname="text-align">
                @foreach (\Modules\Biolinks\Enums\Alignment::cases() as $key => $alignment)
                    <li>
                        <input type="radio" id="text-alignment-{{ $tab->id }}-{{ $key }}"
                            value="{{ $alignment->value }}" name="text_alignment" @checked($alignment == $tab->text_alignment) />
                        <label class="btn" for="text-alignment-{{ $tab->id }}-{{ $key }}"> {{ $alignment->label() }} </label>
                    </li>
                @endforeach
            </ul>
        </div>
    </div>

    <div class="col-sm-12 mt-100">
        <div id="colorpicker">
            <div class="my-3 text-left form-group color-picker block-update"  data-html-type="css" data-attrname="background-color">
                <x-forms.label fieldId="colorselector-{{ $tab->id }}" :fieldLabel="__('biolinks::app.bgColor')"
                    fieldRequired="false">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="text" name="background_color" id="bg-color-{{ $tab->id }}" value="{{ $tab->background_color }}"
                        class="form-control height-35 f-15 light_text">
                    <x-slot name="append">
                        <span class="input-group-text colorpicker-input-addon height-35"><i></i></span>
                    </x-slot>
                </x-forms.input-group>
            </div>
        </div>
    </div>

    <div class="col-sm-12">
        <x-forms.label fieldId="animation-{{ $tab->id }}" :fieldLabel="ucwords(__('biolinks::app.animation'))" fieldRequired="false">
        </x-forms.label>
        <select class="form-control select-picker animation" data-live-search="true" data-size="8" name="animation"
            id="animate-{{ $tab->id }}">
            @foreach (\Modules\Biolinks\Enums\Animation::cases() as $animation)
                <option value="{{ $animation->value }}" @selected($tab->animation == $animation)>{{ $animation->label() }}
                </option>
            @endforeach
        </select>
    </div>
    {{-- BORDER SETTING START --}}

    <div class="col-sm-12 my-3">
        <x-alert type="warning" icon="info-circle">@lang('biolinks::app.borderSettings')</x-alert>
    </div>

    <div class="col-sm-12">
        <x-forms.range class="mr-0 mr-lg-2 mr-md-2"
            :fieldLabel="__('biolinks::app.borderwidth')" fieldName="border_width" :max="5" class="block-update" data-html-type="css" data-attrname="border-width"
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
        <x-forms.label fieldId="border-radius" :fieldLabel="__('biolinks::app.borderRadius')"></x-forms.label>

        <div>
            <ul class="module-list list-unstyled block-update" data-html-type="css" data-attrname="border-radius">
                @foreach (\Modules\Biolinks\Enums\BorderRadius::cases() as $key => $border_radi)
                    <li>
                        <input type="radio" id="border-radius-{{ $tab->id }}-{{ $key }}"
                            value="{{ $border_radi->value }}" name="border_radius" @checked($border_radi == $tab->border_radius) />
                        <label class="btn" for="border-radius-{{ $tab->id }}-{{ $key }}"> {{ $border_radi->label() }} </label>
                    </li>
                @endforeach
            </ul>
        </div>
    </div>

    <div class="col-sm-12 mt-6">
        <x-forms.label fieldId="border-style" :fieldLabel="__('biolinks::app.borderStyle')"></x-forms.label>

        <div>
            <ul class="module-list list-unstyled block-update" data-html-type="css" data-attrname="border-style">
                @foreach (\Modules\Biolinks\Enums\BorderStyle::cases() as $key => $border_style)
                    <li>
                        <input type="radio" id="border-style-{{ $tab->id }}-{{ $key }}"
                            value="{{ $border_style->value }}" name="border_style" @checked($border_style == $tab->border_style ) />
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

    {{-- CUSTOMIZATION SETTINGS END --}}

    <div class="pl-3">
        <x-forms.button-primary id="save-block-{{ $tab->id }}" data-block-id="{{ $tab->id }}" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>

</x-form>

<script>
    $('#agreement-{{ $tab->id }}').on('change', function() {
        $('#show-agreement-{{ $tab->id }}').val(this.checked ? '1' : '0');
    });

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
            buttonSelector: "#save-block-"+blockId,
            success: function (response) {
                if (response.status == 'success') {
                }
            }
        })
    });
</script>
