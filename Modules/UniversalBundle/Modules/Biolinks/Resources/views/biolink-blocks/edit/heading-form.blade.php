<x-form id="edit-block-{{ $tab->id }}" data-block-id="{{ $tab->id }}" method="PUT" class="ajax-form">
    <input type="hidden" name="type" value="heading">
    <div class="col-sm-12">
        <x-forms.label fieldId="headings" :fieldLabel="ucwords(__('validation.attributes.heading'))" fieldRequired="true">
        </x-forms.label>
        <select class="form-control select-picker headings block-update" data-live-search="true" data-size="8" name="heading_type" data-html-type="prop" data-attrname="tagName"
            id="heading">
            @foreach (\Modules\Biolinks\Enums\Heading::cases() as $heading)
                <option value="{{ $heading->value }}" @selected($heading == $tab->heading_type)>{{ $heading->label() }}
                </option>
            @endforeach
        </select>
    </div>

    <div class="col-sm-12">
        <x-forms.text fieldId="name" :fieldLabel="__('app.text')" fieldName="name" fieldValue="{!! $tab->name !!}" class="block-update" data-html-type="text" data-attrname="name"
                      fieldRequired="true" :fieldPlaceholder="__('placeholders.sampleText')">
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
                        <input type="radio" id="text_alignment-{{ $tab->id }}-{{ $key }}"
                            value="{{ $alignment->value }}" name="text_alignment" @checked($alignment == $tab->text_alignment)/>
                        <label class="btn" for="text_alignment-{{ $tab->id }}-{{ $key }}"> {{ $alignment->label() }} </label>
                    </li>
                @endforeach
            </ul>
        </div>
    </div>

    <div class="pl-3 mt-100">
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
                }
            }
        })
    });
</script>
