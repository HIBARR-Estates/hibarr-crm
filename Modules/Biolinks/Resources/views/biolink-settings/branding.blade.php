<div class="row">
    <div class="col-md-12 mt-3 mb-3">
        <div class="form-group mb-lg-0 mb-md-0 mb-4">
            <x-forms.label fieldId="branding_name" :fieldLabel="__('biolinks::app.brandingName')">
            </x-forms.label>
            <div class="input-group">
                <input type="text" class="form-control height-35 f-15" name="branding_name" id="branding_name"
                    value="{{ $biolinkSettings->branding_name }}">
            </div>
        </div>
    </div>

    <div class="col-md-12 mt-3 mb-3">
        <div class="form-group mb-lg-0 mb-md-0 mb-4">
            <x-forms.label fieldId="branding_url" :fieldLabel="__('biolinks::app.brandingUrl')">
            </x-forms.label>
            <div class="input-group">
                <input type="text" class="form-control height-35 f-15" name="branding_url" id="branding_url"
                    value="{{ $biolinkSettings->branding_url }}">
            </div>
        </div>
    </div>

    <div class="col-md-12 mt-3 mb-3">
        <div id="colorpicker" class="input-group">
            <div class="form-group text-left">
                <x-forms.label fieldId="branding_text_color" :fieldLabel="__('biolinks::app.brandingTextColor')" fieldRequired="false">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="text" name="branding_text_color" id="branding_text_color" value="@if($biolinkSettings->branding_text_color) {{ $biolinkSettings->branding_text_color }} @else #0B0C0B @endif"
                        class="form-control height-35 f-15 light_text">
                    <x-slot name="append">
                        <span class="input-group-text colorpicker-input-addon height-35"><i></i></span>
                    </x-slot>
                </x-forms.input-group>
            </div>
        </div>
    </div>
</div>
