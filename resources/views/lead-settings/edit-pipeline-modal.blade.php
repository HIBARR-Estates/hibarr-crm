<link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-colorpicker.css') }}" />

<style>
    #colorpicker .form-group {
        width: 87%;
    }

    /* Pipeline category checkboxes: circular, blue when checked, gray when unchecked */
    .pipeline-category-checkboxes .form-check {
        display: inline-flex;
        align-items: center;
        margin-right: 1rem;
        margin-bottom: 0.5rem;
    }
    .pipeline-category-checkboxes .form-check-input {
        width: 1.25rem;
        height: 1.25rem;
        margin-top: 0;
        margin-right: 2.5rem;
        border: 2px solid #d1d5db;
        border-radius: 50%;
        background-color: #fff;
        appearance: none;
        -webkit-appearance: none;
        flex-shrink: 0;
        cursor: pointer;
        transition: border-color 0.2s, background-color 0.2s, background-image 0.2s;
    }
    .pipeline-category-checkboxes .form-check-input:hover {
        border-color: #9ca3af;
    }
    .pipeline-category-checkboxes .form-check-input:checked {
        border-color: #2563eb;
        background-color: #2563eb;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E");
        background-size: 0.875rem 0.875rem;
        background-position: center;
        background-repeat: no-repeat;
    }
    .pipeline-category-checkboxes .form-check-label {
        cursor: pointer;
        color: #374151;
        font-weight: 500;
        margin-bottom: 0;
    }
</style>


<x-form id="editStatus" method="PUT" class="ajax-form">
    <div class="modal-header">
        <h5 class="modal-title" id="modelHeading">@lang('app.edit') @lang('modules.deal.pipeline')</h5>
        <button type="button"  class="close" data-dismiss="modal" aria-label="Close"><span
                aria-hidden="true">×</span>
        </button>
    </div>

    <div class="modal-body">
        <div class="portlet-body">
                <div class="form-body">
                    <div class="row">
                        <div class="col-sm-4 col-md-12 col-lg-6">
                            <x-forms.text fieldId="type" :fieldLabel="__('app.name')"
                                fieldName="name" fieldRequired="true" :fieldPlaceholder="__('placeholders.status')" :fieldValue="$pipeline->name">
                            </x-forms.text>
                        </div>
                        <div class="col-sm-4 col-md-12 col-lg-6">
                            <div id="colorpicker" class="input-group">

                                <div class="form-group my-3 text-left">
                                    <x-forms.label fieldId="colorselector" :fieldLabel="__('modules.tasks.labelColor')"
                                        fieldRequired="true">
                                    </x-forms.label>
                                    <x-forms.input-group>
                                        <input type="text" name="label_color" id="colorselector" value="{{ $pipeline->label_color }}"
                                            class="form-control height-35 f-15 light_text">
                                        <x-slot name="append">
                                            <span class="input-group-text colorpicker-input-addon height-35"><i></i></span>
                                        </x-slot>
                                    </x-forms.input-group>
                                </div>
                            </div>
                        </div>

                        @if(isset($customFieldCategories) && $customFieldCategories->isNotEmpty())
                        <div class="col-md-12 col-lg-12 mt-3">
                            <div class="form-group">
                                <x-forms.label fieldId="category_ids" :fieldLabel="__('app.menu.customFieldCategories')" />
                                <div class="d-flex flex-wrap gap-3 pipeline-category-checkboxes">
                                    @foreach($customFieldCategories as $category)
                                    <div class="form-check">
                                        <input type="checkbox" class="form-check-input" name="category_ids[]"
                                            id="category_ids_{{ $category->id }}" value="{{ $category->id }}"
                                            {{ in_array($category->id, $pipelineCategoryIds ?? []) ? 'checked' : '' }}>
                                        <label class="form-check-label" for="category_ids_{{ $category->id }}">{{ $category->name }}</label>
                                    </div>
                                    @endforeach
                                </div>
                                <small class="form-text text-muted">@lang('modules.deal.pipelineCategoryHint')</small>
                            </div>
                        </div>
                        @endif

                    </div>
                </div>
        </div>
    </div>

    <div class="modal-footer">

        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
        @if(!$pipeline->default)
            <button type="button" class="btn-danger rounded f-14 p-2 delete-pipeline">
                    <i class="fa fa-trash mr-3"></i>
                    @lang('app.delete')
            </button>
        @endif


        <x-forms.button-primary id="save-status" icon="check">@lang('app.save')</x-forms.button-primary>

    </div>
</x-form>

<script>

    $('#colorpicker').colorpicker({"color": "{{ $pipeline->label_color }}"});

    $(".select-picker").selectpicker();

    // save status
    $('#save-status').click(function() {
        $.easyAjax({
            url: "{{route('lead-pipeline-setting.update', $pipeline->id)}}",
            container: '#editStatus',
            type: "POST",
            blockUI: true,
            blockUI: true,
            disableButton: true,
            buttonSelector: "#save-status",
            data: $('#editStatus').serialize(),
            success: function(response) {
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        })
    });

    $('body').on('click', '.delete-pipeline', function() {
            var id = {{ $pipeline->id }};
            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('messages.deal.deletePipeline', ['stages' => $pipeline->stages->count(), 'deals' => $pipeline->deals->count()])",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: "@lang('messages.confirmDelete')",
                cancelButtonText: "@lang('app.cancel')",
                customClass: {
                    confirmButton: 'btn btn-primary mr-3',
                    cancelButton: 'btn btn-secondary'
                },
                showClass: {
                    popup: 'swal2-noanimation',
                    backdrop: 'swal2-noanimation'
                },
                buttonsStyling: false
            }).then((result) => {
                if (result.isConfirmed) {
                    var url = "{{ route('lead-pipeline-setting.destroy', ':id') }}";
                    url = url.replace(':id', id);

                    var token = "{{ csrf_token() }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        data: {
                            '_token': token,
                            '_method': 'DELETE'
                        },
                        success: function(response) {
                            if (response.status == "success") {
                                window.location.reload();
                            }
                        }
                    });
                }
            });
        });

</script>
