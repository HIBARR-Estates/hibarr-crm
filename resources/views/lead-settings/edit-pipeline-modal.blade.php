<link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-colorpicker.css') }}" />

<style>
    #colorpicker .form-group {
        width: 87%;
    }

    .pipeline-scope-toggle {
        border: none;
        background: transparent;
    }

    .pipeline-scope-toggle:hover,
    .pipeline-scope-toggle:focus {
        text-decoration: none;
        color: #28313c;
    }

    .pipeline-scope-chevron {
        transition: transform 0.2s ease;
        width: 14px;
    }

    .pipeline-scope-toggle:not(.collapsed) .pipeline-scope-chevron {
        transform: rotate(180deg);
    }
</style>

@php
    $pipelineCategoryIds = $categoryScopes['__pipeline__'] ?? [];
    $stageCategoryIds = $categoryScopes['stages'] ?? [];
    $pipelineFieldKeys = $pipelineFieldScopeMap['__pipeline__'] ?? [];
    $stageFieldKeys = $pipelineFieldScopeMap['stages'] ?? [];

    $categoryItems = isset($customFieldCategories)
        ? $customFieldCategories->map(fn ($category) => [
            'value' => $category->id,
            'label' => $category->name,
            'id' => 'cat_item_' . $category->id,
        ])->all()
        : [];
@endphp

<x-form id="editStatus" method="PUT" class="ajax-form">
    <div class="modal-header">
        <h5 class="modal-title" id="modelHeading">@lang('app.edit') @lang('modules.deal.pipeline')</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
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
                                <x-forms.label fieldId="colorselector" :fieldLabel="__('modules.tasks.labelColor')" fieldRequired="true"></x-forms.label>
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

                    @if(!empty($categoryItems))
                    <div class="col-md-12">
                        <hr class="my-3">
                        <button class="pipeline-scope-toggle btn btn-link btn-block text-left p-0 mb-3 f-16 font-weight-normal text-dark collapsed"
                            type="button"
                            data-toggle="collapse"
                            data-target="#pipelineCategoriesCollapse"
                            aria-expanded="false"
                            aria-controls="pipelineCategoriesCollapse">
                            <i class="fa fa-chevron-down pipeline-scope-chevron mr-2"></i>
                            @lang('app.menu.customFieldCategories')
                        </button>

                        <div id="pipelineCategoriesCollapse" class="collapse">
                        <div class="bg-light rounded p-3 mb-3">
                            <x-forms.label fieldId="pipeline_wide_categories" :fieldLabel="__('modules.deal.pipelineWideCategories')" />
                            <x-deal.pipeline-scope-pills
                                inputName="category_scopes[__pipeline__][]"
                                :items="$categoryItems"
                                :selected="$pipelineCategoryIds"
                                fieldIdPrefix="cat_pipeline"
                                :searchPlaceholder="__('app.search')"
                                :hint="__('modules.deal.pipelineCategoryHint')" />
                        </div>

                        @foreach($pipeline->stages as $stage)
                        <div class="bg-light rounded p-3 mb-3">
                            <div class="f-14 text-dark-grey mb-12">
                                @lang('modules.deal.stageCategories'):
                                <x-status :value="$stage->name" :style="'color:'.$stage->label_color" />
                            </div>
                            <x-deal.pipeline-scope-pills
                                :inputName="'category_scopes['.$stage->id.'][]'"
                                :items="$categoryItems"
                                :selected="$stageCategoryIds[$stage->id] ?? []"
                                :fieldIdPrefix="'cat_stage_'.$stage->id"
                                :searchPlaceholder="__('app.search')" />
                        </div>
                        @endforeach
                        </div>
                    </div>
                    @endif

                    @if(!empty($scopeableFieldsCatalog))
                    <div class="col-md-12">
                        <hr class="my-3">
                        <button class="pipeline-scope-toggle btn btn-link btn-block text-left p-0 mb-3 f-16 font-weight-normal text-dark collapsed"
                            type="button"
                            data-toggle="collapse"
                            data-target="#pipelineFieldsCollapse"
                            aria-expanded="false"
                            aria-controls="pipelineFieldsCollapse">
                            <i class="fa fa-chevron-down pipeline-scope-chevron mr-2"></i>
                            @lang('modules.deal.pipelineWideFields')
                        </button>

                        <div id="pipelineFieldsCollapse" class="collapse">
                        <div class="bg-light rounded p-3 mb-3">
                            <x-forms.label fieldId="pipeline_wide_fields" :fieldLabel="__('modules.deal.pipelineWideFields')" />
                            @foreach($scopeableFieldsCatalog as $model => $fields)
                                <x-forms.label :fieldId="'field_group_pipeline_'.md5($model)" :fieldLabel="class_basename($model)" />
                                @php
                                    $fieldItems = collect($fields)->map(function ($fieldLabel, $fieldKey) use ($model) {
                                        return [
                                            'value' => $model . '|native_field|' . $fieldKey,
                                            'label' => $fieldLabel,
                                            'id' => 'field_pipeline_' . md5($model . $fieldKey),
                                        ];
                                    })->values()->all();
                                    $selectedPipelineFieldKeys = collect($pipelineFieldKeys)
                                        ->filter(fn ($key) => str_starts_with($key, $model . '|'))
                                        ->values()
                                        ->all();
                                @endphp
                                <x-deal.pipeline-scope-pills
                                    inputName="field_scopes[__pipeline__][]"
                                    :items="$fieldItems"
                                    :selected="$selectedPipelineFieldKeys"
                                    :fieldIdPrefix="'field_pipeline_' . md5($model)"
                                    :searchPlaceholder="__('app.search')" />
                            @endforeach
                            <p class="f-11 text-lightest mt-1 mb-0">@lang('modules.deal.pipelineFieldHint')</p>
                        </div>

                        @foreach($pipeline->stages as $stage)
                        <div class="bg-light rounded p-3 mb-3">
                            <div class="f-14 text-dark-grey mb-12">
                                @lang('modules.deal.stageFields'):
                                <x-status :value="$stage->name" :style="'color:'.$stage->label_color" />
                            </div>
                            @foreach($scopeableFieldsCatalog as $model => $fields)
                                <x-forms.label :fieldId="'field_group_stage_'.$stage->id.'_'.md5($model)" :fieldLabel="class_basename($model)" />
                                @php
                                    $stageFieldItems = collect($fields)->map(function ($fieldLabel, $fieldKey) use ($model, $stage) {
                                        return [
                                            'value' => $model . '|native_field|' . $fieldKey,
                                            'label' => $fieldLabel,
                                            'id' => 'field_stage_' . $stage->id . '_' . md5($model . $fieldKey),
                                        ];
                                    })->values()->all();
                                    $selectedStageFieldKeys = collect($stageFieldKeys[$stage->id] ?? [])
                                        ->filter(fn ($key) => str_starts_with($key, $model . '|'))
                                        ->values()
                                        ->all();
                                @endphp
                                <x-deal.pipeline-scope-pills
                                    :inputName="'field_scopes['.$stage->id.'][]'"
                                    :items="$stageFieldItems"
                                    :selected="$selectedStageFieldKeys"
                                    :fieldIdPrefix="'field_stage_'.$stage->id.'_'.md5($model)"
                                    :searchPlaceholder="__('app.search')" />
                            @endforeach
                        </div>
                        @endforeach
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
            <x-forms.button-secondary type="button" class="delete-pipeline text-danger border-danger">
                <i class="fa fa-trash mr-1"></i>@lang('app.delete')
            </x-forms.button-secondary>
        @endif
        <x-forms.button-primary id="save-status" icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>

@include('components.deal.partials.pipeline-scope-pills-init')

<script>
    initPipelineScopePills($('#editStatus'));
    $('#colorpicker').colorpicker({"color": "{{ $pipeline->label_color }}"});
    $(".select-picker").selectpicker();

    $('#save-status').click(function() {
        if (typeof window.syncPipelineScopePillsInputs === 'function') {
            window.syncPipelineScopePillsInputs($('#editStatus'));
        }

        $.easyAjax({
            url: "{{ route('lead-pipeline-setting.update', $pipeline->id) }}",
            container: '#editStatus',
            type: "POST",
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

    $('body').off('click.deletePipeline', '.delete-pipeline').on('click.deletePipeline', '.delete-pipeline', function() {
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
            showClass: { popup: 'swal2-noanimation', backdrop: 'swal2-noanimation' },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {
                var url = "{{ route('lead-pipeline-setting.destroy', ':id') }}".replace(':id', id);
                $.easyAjax({
                    type: 'POST',
                    url: url,
                    data: { '_token': "{{ csrf_token() }}", '_method': 'DELETE' },
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
