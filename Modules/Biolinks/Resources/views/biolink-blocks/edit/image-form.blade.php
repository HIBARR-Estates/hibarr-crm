<x-form id="edit-block-{{ $tab->id }}" method="PUT" data-block-id="{{ $tab->id }}" class="ajax-form">
    <input type="hidden" name="type" value="image">

    <div class="col-md-12">
        <x-forms.file allowedFileExtensions="png jpg jpeg svg bmp" class="mr-0 mr-lg-2 mr-md-2 cropper block-update"  data-html-type="attr" data-attrname="src"
                      :fieldLabel="__('biolinks::app.image')" fieldName="image" fieldId="image"
                      :fieldValue="$tab->file_url" fieldRequired="true"
                      fieldHeight="70" />
    </div>

    <div class="col-sm-12">
        <x-forms.url fieldId="url-{{ $tab->id }}" :fieldLabel="__('app.url')" fieldName="url" fieldValue="{{ $tab->url }}"
                    fieldRequired="true" :fieldPlaceholder="__('placeholders.website')">
        </x-forms.url>
    </div>

    <div class="col-sm-12">
        <x-forms.text fieldId="image-alt-{{ $tab->id }}" :fieldLabel="__('biolinks::app.imageAlt')" fieldName="image_alt" fieldValue="{{ $tab->image_alt }}"
                      fieldRequired="true" :fieldPlaceholder="__('placeholders.name')">
        </x-forms.text>
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
