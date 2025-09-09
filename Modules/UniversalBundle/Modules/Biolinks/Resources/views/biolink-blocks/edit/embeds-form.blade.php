<x-form id="edit-block-{{ $tab->id }}" method="PUT" class="ajax-form">
    <input type="hidden" name="type" value="embeds">
    <input type="hidden" name="blockId" value="{{ $tab->id }}">
    <div class="col-sm-12">
        <x-forms.text fieldId="url-{{ $tab->id }}" :fieldLabel="$tab->name. ' ' .__('app.url')" fieldName="url" fieldValue="{{ $tab->url }}"
                    fieldRequired="true" :fieldPlaceholder="__('placeholders.website')">
        </x-forms.text>
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
            buttonSelector: "#save-block-"+blockId,
            success: function (response) {
                if (response.status == 'success') {
                }
            }
        })
    });
</script>
