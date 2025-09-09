<div class="modal-header">
    <h5 class="modal-title">@lang('app.edit') @lang('biolinks::app.biolink')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>
<x-form id="edit-biolinks" method="POST" class="ajax-form">
    <div class="modal-body">
        <div class="row">
            <div class="col-sm-12">
                <x-forms.label class="my-3" fieldId="page_link" :fieldLabel="__('biolinks::app.biolinkPageUrl')" :fieldRequired='true'></x-forms.label>
                <x-forms.input-group>
                    <x-slot name="prepend">
                        <span class="input-group-text">{{ route('biolink.index', '') . '/' }}</span>
                    </x-slot>

                    <input type="text" class="form-control height-35 f-14" name="page_link" id="page_link"
                        value="{{ $biolink->page_link }}">
                </x-forms.input-group>
            </div>

        </div>
    </div>
    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="mr-3 border-0">@lang('app.close')</x-forms.button-cancel>
        <x-forms.button-primary id="save-biolinks" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>


<script>
    $('#save-biolinks').on('click', function() {
        var url = "{{ route('biolinks.update', ':id') }}";
        url = url.replace(':id', '{{ $biolink->id }}');

        $.easyAjax({
            url: url,
            container: '#edit-biolinks',
            type: "PUT",
            disableButton: true,
            blockUI: true,
            buttonSelector: "#save-biolinks",
            data: $('#edit-biolinks').serialize(),
            success: function(response) {
                if (response.status == 'success') {
                    let id = response.id;
                    let editUrl = "{{ route('biolinks.edit', ':id') }}";
                    editUrl = editUrl.replace(':id', id);
                    window.location.href = editUrl;
                }
            }
        });
    });
</script>
