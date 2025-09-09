<x-form id="edit-block-{{ $tab->id }}" method="PUT" data-block-id="{{ $tab->id }}" class="ajax-form">
    <input type="hidden" name="type" value="socials">

    <div class="col-sm-12">
        <div id="colorpicker">
            <div class="my-3 text-left form-group color-picker block-update" data-html-type="css" data-attrname="color">
                <x-forms.label fieldId="colorselector" :fieldLabel="__('modules.tasks.labelColor')"
                    fieldRequired="true">
                </x-forms.label>
                <x-forms.input-group>
                    <input type="text" name="text_color" id="colorselector" value="{{ $tab->text_color }}"
                        class="form-control height-35 f-15 light_text">
                    <x-slot name="append">
                        <span class="input-group-text colorpicker-input-addon height-35"><i></i></span>
                    </x-slot>
                </x-forms.input-group>
            </div>
        </div>
    </div>
    <div class="col-sm-12">
        <x-forms.label fieldId="size" class="my-3" :fieldLabel="__('biolinks::app.size')" fieldRequired="true">
        </x-forms.label>
        <select class="form-control select-picker size block-update" data-live-search="true" data-size="8" name="icon_size" data-html-type="css" data-attrname="font-size"
            id="size">
            @foreach (\Modules\Biolinks\Enums\Size::cases() as $size)
                <option value="{{ $size->value }}" @selected($size == $tab->icon_size)>{{ $size->label() }}
                </option>
            @endforeach
        </select>
    </div>
    <div class="col-sm-12">
        <x-forms.email fieldId="email-{{ $tab->id }}" :fieldLabel="__('app.email')" fieldName="email" :fieldValue="$tab->email"
             :fieldPlaceholder="__('placeholders.email')">
        </x-forms.email>
    </div>
    <div class="col-sm-12">
        <x-forms.text fieldId="phone" :fieldLabel="__('biolinks::app.phoneNumber')" :fieldValue="$tab->phone"
            fieldName="phone" :fieldPlaceholder="__('placeholders.mobileWithPlus')">
        </x-forms.text>
    </div>
    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="telegram" :fieldLabel="__('biolinks::app.telegram')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">t.me/</span>
                </x-slot>
                <input type="text" name="telegram" id="telegram" value="{{ $tab->telegram }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>
    <div class="col-sm-12">
        <x-forms.text fieldId="whatsapp" :fieldLabel="__('biolinks::app.whatsapp')" fieldName="whatsapp" :fieldValue="$tab->whatsapp"
                      fieldRequired="false" :fieldPlaceholder="__('placeholders.mobile')">
        </x-forms.text>
    </div>
    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="facebook" :fieldLabel="__('biolinks::app.facebook')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">facebook.com/</span>
                </x-slot>
                <input type="text" name="facebook" id="facebook" value="{{ $tab->facebook }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>
    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="instagram" :fieldLabel="__('biolinks::app.instagram')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">instagram.com/</span>
                </x-slot>
                <input type="text" name="instagram" id="instagram" value="{{ $tab->instagram }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>
    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="twitter" :fieldLabel="__('biolinks::app.twitter')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">x.com/</span>
                </x-slot>
                <input type="text" name="twitter" id="twitter" value="{{ $tab->twitter }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>
    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="youtube" :fieldLabel="__('biolinks::app.youtubeChannel')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">youtube.com/</span>
                </x-slot>
                <input type="text" name="youtube" id="youtube" value="{{ $tab->youtube }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>
    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="linkedin" :fieldLabel="__('biolinks::app.linkedin')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">linkedin.com/</span>
                </x-slot>
                <input type="text" name="linkedin" id="linkedin" value="{{ $tab->linkedin }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>
    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="discord" :fieldLabel="__('biolinks::app.discord')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">discord.gg/</span>
                </x-slot>
                <input type="text" name="discord" id="discord" value="{{ $tab->discord }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>
    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="snapchat" :fieldLabel="__('biolinks::app.snapchat')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">snapchat.com/add/</span>
                </x-slot>
                <input type="text" name="snapchat" id="snapchat" value="{{ $tab->snapchat }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>
    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="pinterest" :fieldLabel="__('biolinks::app.pinterest')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">pinterest.com/</span>
                </x-slot>
                <input type="text" name="pinterest" id="pinterest" value="{{ $tab->pinterest }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>
    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="reddit" :fieldLabel="__('biolinks::app.reddit')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">reddit.com/</span>
                </x-slot>
                <input type="text" name="reddit" id="reddit" value="{{ $tab->reddit }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>
    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="tiktok" :fieldLabel="__('biolinks::app.tiktok')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">tiktok.com/@</span>
                </x-slot>
                <input type="text" name="tiktok" id="tiktok" value="{{ $tab->tiktok }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>

    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="spotify" :fieldLabel="__('biolinks::app.spotify')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">open.spotify.com/artist/</span>
                </x-slot>
                <input type="text" name="spotify" id="spotify" value="{{ $tab->spotify }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>

    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="threads" :fieldLabel="__('biolinks::app.threads')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">threads.net/@</span>
                </x-slot>
                <input type="text" name="threads" id="threads" value="{{ $tab->threads }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>

    <div class="col-sm-12">
        <div class="mb-3 form-group">
            <x-forms.label class="mb-12" fieldId="twitch" :fieldLabel="__('biolinks::app.twitch')">
            </x-forms.label>
            <x-forms.input-group>
                <x-slot name="prepend">
                    <span
                        class="input-group-text">twitch.tv/</span>
                </x-slot>
                <input type="text" name="twitch" id="twitch" value="{{ $tab->twitch }}"
                    class="form-control height-35 f-15">
            </x-forms.input-group>
        </div>
    </div>

    <div class="col-sm-12">
        <x-forms.text fieldId="address" :fieldLabel="__('app.address')" fieldName="address" :fieldValue="$tab->address"
                      fieldRequired="false" :fieldPlaceholder="__('placeholders.address')">
        </x-forms.text>
    </div>

    <div class="pl-3">
        <x-forms.button-primary id="save-block-{{ $tab->id }}" data-block-id="{{ $tab->id }}" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>

</x-form>

<script>

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
                    iframePreview();
                }
            }
        })
    });
</script>
