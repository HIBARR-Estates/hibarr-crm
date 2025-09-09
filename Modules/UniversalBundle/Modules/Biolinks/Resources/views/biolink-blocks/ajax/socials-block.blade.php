<link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-colorpicker.css') }}" />

<div class="modal-header">
    <h5 class="modal-title">@lang('biolinks::app.addLinkButton')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>
<x-form id="create-block" method="POST" class="ajax-form">
    <div class="modal-body">
        <div class="row">
            <input type="hidden" name="biolink_id" value="{{ $biolinkId }}">
            <input type="hidden" name="type" value="socials">

            <div class="col-sm-12">
                <div id="colorpicker">
                    <div class="my-3 text-left form-group color-picker">
                        <x-forms.label fieldId="colorselector" :fieldLabel="__('modules.tasks.labelColor')"
                            fieldRequired="true">
                        </x-forms.label>
                        <x-forms.input-group>
                            <input type="text" name="text_color" id="colorselector" value="#16813D"
                                class="form-control height-35 f-15 light_text">
                            <x-slot name="append">
                                <span class="input-group-text colorpicker-input-addon height-35"><i></i></span>
                            </x-slot>
                        </x-forms.input-group>
                    </div>
                </div>
            </div>
            <div class="col-sm-12 form-group">
                <x-forms.label fieldId="size" class="my-3" :fieldLabel="__('biolinks::app.size')" fieldRequired="true">
                </x-forms.label>
                <select class="form-control select-picker size" data-live-search="true" data-size="8" name="icon_size"
                    id="size">
                    @foreach (\Modules\Biolinks\Enums\Size::cases() as $size)
                        <option value="{{ $size->value }}">{{ $size->label() }}
                        </option>
                    @endforeach
                </select>
            </div>
            <div class="col-sm-12">
                <x-forms.email fieldId="email" :fieldLabel="__('app.email')" fieldName="email"
                     :fieldPlaceholder="__('placeholders.email')">
                </x-forms.email>
            </div>
            <div class="col-sm-12">
                <x-forms.text fieldId="phone" :fieldLabel="__('biolinks::app.phoneNumber')"
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
                        <input type="text" name="telegram" id="telegram"
                            class="form-control height-35 f-15">
                    </x-forms.input-group>
                </div>
            </div>
            <div class="col-sm-12">
                <x-forms.text fieldId="whatsapp" :fieldLabel="__('biolinks::app.whatsapp')" fieldName="whatsapp"
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
                        <input type="text" name="facebook" id="facebook"
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
                        <input type="text" name="instagram" id="instagram"
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
                        <input type="text" name="twitter" id="twitter"
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
                        <input type="text" name="youtube" id="youtube"
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
                        <input type="text" name="linkedin" id="linkedin"
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
                        <input type="text" name="discord" id="discord"
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
                        <input type="text" name="snapchat" id="snapchat"
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
                        <input type="text" name="pinterest" id="pinterest"
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
                        <input type="text" name="reddit" id="reddit"
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
                        <input type="text" name="tiktok" id="tiktok"
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
                        <input type="text" name="spotify" id="spotify"
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
                        <input type="text" name="threads" id="threads"
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
                        <input type="text" name="twitch" id="twitch"
                            class="form-control height-35 f-15">
                    </x-forms.input-group>
                </div>
            </div>
            <div class="col-sm-12">
                <x-forms.text fieldId="address" :fieldLabel="__('app.address')" fieldName="address"
                              fieldRequired="false" :fieldPlaceholder="__('placeholders.address')">
                </x-forms.text>
            </div>
        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="mr-3 border-0">@lang('app.close')</x-forms.button-cancel>
        <x-forms.button-primary id="save-block" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>

<script src="{{ asset('vendor/jquery/bootstrap-colorpicker.js') }}"></script>
<script>
    $('.color-picker').colorpicker({"color": "#16813D"});
    $('.select-picker').selectpicker();

    $('#save-block').on('click', function () {
        var url = "{{ route('biolink-blocks.store') }}";
        $.easyAjax({
            url: url,
            container: '#create-block',
            type: "POST",
            data: $('#create-block').serialize(),
            disableButton: true,
            blockUI: true,
            buttonSelector: "#save-block",
            success: function (response) {
                if (response.status == 'success') {
                    $(MODAL_LG).modal('hide');
                    $(RIGHT_MODAL).modal('hide');
                    localStorage.setItem('activeTab', 'blocks');
                    window.location.href= response.redirectUrl;
                }
            }
        })
    });
</script>
