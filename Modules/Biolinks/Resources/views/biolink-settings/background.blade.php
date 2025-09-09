<div class="row">
    <div class="col-md-12 mt-3 mb-2">
        <input type="hidden" id="theme_color" name="theme_color" value="@if ($biolinkSettings->theme_color) {{ $biolinkSettings->theme_color }} @else linear-gradient(to bottom, #ff758c, #ff7eb3) @endif">
        <label class="f-14 text-dark-grey w-100" for="usr">@lang('biolinks::app.theme')</label>
        <ul class="module-list list-unstyled">
            @foreach (\Modules\Biolinks\Enums\Theme::cases() as $theme)
                <li>
                    <input type="radio"  @checked($biolinkSettings->theme == $theme) id="theme{{ $theme->value }}"
                        value="{{ $theme->value }}" name="theme" />
                    <label class="btn" for="theme{{ $theme->value }}"> {{ $theme->label() }} </label>
                </li>
            @endforeach
        </ul>
    </div>

    <div class="col-md-6 mt-3 mb-3">
        <div id="colorpicker-one" class="input-group @if($biolinkSettings->theme != 'Custom') d-none @endif">
            <div class="form-group w-100">
                <x-forms.label fieldId="custom_color_one" :fieldLabel="__('biolinks::app.customColorOne')" fieldRequired="false">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="text" name="custom_color_one" id="custom_color_one" value="@if($biolinkSettings->custom_color_one) {{ $biolinkSettings->custom_color_one }} @else #7EE7F9 @endif"
                        class="form-control height-35 f-15 light_text">
                    <x-slot name="append">
                        <span class="input-group-text colorpicker-input-addon height-35"><i></i></span>
                    </x-slot>
                </x-forms.input-group>
            </div>
        </div>
    </div>

    <div class="col-md-6 mt-3 mb-3">
        <div id="colorpicker-two" class="input-group @if($biolinkSettings->theme != 'Custom') d-none @endif">
            <div class="form-group w-100">
                <x-forms.label fieldId="custom_color_two" :fieldLabel="__('biolinks::app.customColorTwo')" fieldRequired="false">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="text" name="custom_color_two" id="custom_color_two" value="@if($biolinkSettings->custom_color_two) {{ $biolinkSettings->custom_color_two }} @else #226722 @endif"
                        class="form-control height-35 f-15 light_text">
                    <x-slot name="append">
                        <span class="input-group-text colorpicker-input-addon height-35"><i></i></span>
                    </x-slot>
                </x-forms.input-group>
            </div>
        </div>
    </div>

    <div class="col-md-12">
        <x-forms.file allowedFileExtensions="png jpg jpeg svg bmp" class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('modules.accountSettings.faviconImage')"
            :popover="__('modules.themeSettings.faviconSize')" :fieldValue="$biolinkSettings->favicon_url" fieldName="favicon" fieldId="favicon" :popover="__('messages.fileFormat.ImageFile')" />
    </div>

    <div class="col-md-12 mt-3 mb-3">
        <label class="f-14 text-dark-grey mb-12 w-100" for="usr">@lang('biolinks::app.chooseFont')</label>
        <ul class="module-list list-unstyled">
            @foreach (\Modules\Biolinks\Enums\Font::cases() as $index => $font)
                <li>
                    <input type="radio" @checked($biolinkSettings->font == $font) id="font{{ $font->value }}"
                        value="{{ $font->value }}" name="font" />
                    <label class="btn font-family-btn" for="font{{ $font->value }}"> {{ $font->label() }} </label>
                </li>
            @endforeach
        </ul>
    </div>

    <div class="col-md-12 mt-3 mb-3">
        <label class="f-14 text-dark-grey w-100" for="usr">@lang('biolinks::app.blockSpace')</label>
        <ul class="module-list list-unstyled">
            @foreach (\Modules\Biolinks\Enums\BlockSpacing::cases() as $space)
                <li>
                    <input type="radio" @checked($biolinkSettings->block_space == $space) id="block_space{{ $space->value }}"
                        value="{{ $space->value }}" name="block_space" />
                    <label class="btn" for="block_space{{ $space->value }}"> {{ $space->label() }} </label>
                </li>
            @endforeach
        </ul>
    </div>

    <div class="col-md-12 mt-3 mb-3">
        <label class="f-14 text-dark-grey w-100" for="usr">@lang('biolinks::app.blockAnimation')</label>
        <ul class="module-list list-unstyled">
            @foreach (\Modules\Biolinks\Enums\BlockHoverAnimation::cases() as $animation)
                <li>
                    <input type="radio" @checked($biolinkSettings->block_hover_animation == $animation) id="block_animation{{ $animation->value }}"
                        value="{{ $animation->value }}" name="block_animation" />
                    <label class="btn" for="block_animation{{ $animation->value }}"> {{ $animation->label() }} </label>
                </li>
            @endforeach
        </ul>
    </div>
</div>
