<div class="modal-header">
    <h5 class="modal-title">@lang('app.add') @lang('biolinks::app.avatar')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>
<x-form id="create-block" method="POST" class="ajax-form">
    <div class="modal-body">
        <div class="row">
            <input type="hidden" name="biolink_id" value="{{ $biolinkId }}">
            <input type="hidden" name="type" value="avatar">

            <div class="col-lg-12 form-group">
                <x-forms.label class="my-3" fieldId="image-label"
                    :fieldLabel="ucwords(__('validation.attributes.image'))" fieldRequired="true">
                </x-forms.label>
                <input type="file" class="image" id="dropify" name="image" class="cropper"
                            data-allowed-file-extensions="png jpg jpeg bmp" data-messages-default="test" data-height="70"/>
            </div>
            <div class="col-sm-12 form-group">
                <x-forms.label fieldId="avatar-size" class="my-3" :fieldLabel="__('biolinks::app.avatarSize')" fieldRequired="true">
                </x-forms.label>
                <select class="form-control select-picker avatar-size" data-live-search="true" data-size="8" name="avatar_size"
                    id="avatar-size">
                    @foreach (\Modules\Biolinks\Enums\AvatarSize::cases() as $avatarSize)
                        <option value="{{ $avatarSize->value }}">{{ $avatarSize->value . 'X' .  $avatarSize->value }}
                        </option>
                    @endforeach
                </select>
            </div>
            <div class="col-sm-12 form-group">
                <x-forms.label fieldId="border-radius" class="my-3" :fieldLabel="__('biolinks::app.borderRadius')" fieldRequired="true">
                </x-forms.label>
                <select class="form-control select-picker border-radius" data-live-search="true" data-size="8" name="border_radius"
                    id="border-radius">
                    @foreach (\Modules\Biolinks\Enums\BorderRadius::cases() as $borderRadi)
                        <option value="{{ $borderRadi->value }}">{{ $borderRadi->label() }}
                        </option>
                    @endforeach
                </select>
            </div>

        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="mr-3 border-0">@lang('app.close')</x-forms.button-cancel>
        <x-forms.button-primary id="save-block" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>

<script>
    $("#dropify").dropify({
        messages: dropifyMessages
    });
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
                file: true,
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

