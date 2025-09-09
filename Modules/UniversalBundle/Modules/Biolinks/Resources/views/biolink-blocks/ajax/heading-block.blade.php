<div class="modal-header">
    <h5 class="modal-title">@lang('biolinks::app.addHeading')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>
<x-form id="create-block" method="POST" class="ajax-form">
    <div class="modal-body">
        <div class="row">
            <input type="hidden" name="biolink_id" value="{{ $biolinkId }}">
            <input type="hidden" name="type" value="heading">

            <div class="col-sm-12 form-group">
                <x-forms.label fieldId="headings" :fieldLabel="ucwords(__('validation.attributes.heading'))" fieldRequired="true">
                </x-forms.label>
                <select class="form-control select-picker headings" data-live-search="true" data-size="8" name="heading_type"
                    id="heading">
                    @foreach (\Modules\Biolinks\Enums\Heading::cases() as $heading)
                        <option value="{{ $heading->value }}">{{ $heading->label() }}
                        </option>
                    @endforeach
                </select>
            </div>
            <div class="col-sm-12">
                <x-forms.text fieldId="name" :fieldLabel="__('app.text')" fieldName="name"
                              fieldRequired="true" :fieldPlaceholder="__('placeholders.sampleText')">
                </x-forms.text>
            </div>

        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="mr-3 border-0">@lang('app.close')</x-forms.button-cancel>
        <x-forms.button-primary id="save-block" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>


<script>

    $(".select-picker").selectpicker();

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
