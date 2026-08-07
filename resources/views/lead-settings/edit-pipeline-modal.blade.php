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

    .cursor-move { cursor: move; }
    #analysis-script-items .analysis-item-row { background: #f8f9fb; }
    #analysis-script-items .ui-sortable-helper { box-shadow: 0 4px 12px rgba(0,0,0,.12); }
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

    // Analysis Script steps must be built from categories actually linked to this
    // pipeline (pipeline-wide or on any of its stages), not every category in the company.
    $linkedCategoryIds = collect($pipelineCategoryIds)
        ->merge(collect($stageCategoryIds)->flatten())
        ->map(fn ($id) => (int) $id)
        ->unique();

    $linkedCustomFieldCategories = isset($customFieldCategories)
        ? $customFieldCategories->whereIn('id', $linkedCategoryIds)->values()
        : collect();
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
                            <div class="custom-control custom-checkbox mb-2">
                                <input type="checkbox" class="custom-control-input" id="hide_all_categories"
                                    name="hide_all_categories" value="1"
                                    @checked($pipeline->hide_all_categories)>
                                <label class="custom-control-label" for="hide_all_categories">
                                    @lang('modules.deal.hideAllCategories')
                                </label>
                            </div>
                            <p class="f-11 text-lightest mt-1 mb-0">@lang('modules.deal.hideAllCategoriesHint')</p>
                        </div>

                        <div id="pipelineCategoriesSelection" class="{{ $pipeline->hide_all_categories ? 'opacity-50' : '' }}"
                            @if($pipeline->hide_all_categories) inert @endif>
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
                                        // Must match syncFieldScopes()'s own type derivation
                                        // (LeadPipelineSettingController) — otherwise a
                                        // previously-saved custom/hibarr field scope won't
                                        // match its option value here and silently shows as
                                        // unchecked, so re-saving the form would drop it.
                                        $fieldType = str_starts_with($fieldKey, 'custom_field_')
                                            ? 'custom_field'
                                            : (array_key_exists($fieldKey, \App\Services\PipelineScopeResolverService::HIBARR_FIELDS)
                                                ? 'hibarr_field'
                                                : 'native_field');
                                        return [
                                            'value' => $model . '|' . $fieldType . '|' . $fieldKey,
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
                                        // See the pipeline-wide block above — must match
                                        // syncFieldScopes()'s type derivation.
                                        $fieldType = str_starts_with($fieldKey, 'custom_field_')
                                            ? 'custom_field'
                                            : (array_key_exists($fieldKey, \App\Services\PipelineScopeResolverService::HIBARR_FIELDS)
                                                ? 'hibarr_field'
                                                : 'native_field');
                                        return [
                                            'value' => $model . '|' . $fieldType . '|' . $fieldKey,
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
                    {{-- ── Analysis Script ── --}}
                    <div class="col-md-12">
                        <hr class="my-3">
                        <button class="pipeline-scope-toggle btn btn-link btn-block text-left p-0 mb-3 f-16 font-weight-normal text-dark collapsed"
                            type="button"
                            data-toggle="collapse"
                            data-target="#analysisScriptCollapse"
                            aria-expanded="false"
                            aria-controls="analysisScriptCollapse">
                            <i class="fa fa-chevron-down pipeline-scope-chevron mr-2"></i>
                            Analysis Script
                        </button>

                        <div id="analysisScriptCollapse" class="collapse">
                            <p class="f-12 text-lightest mb-2">Configure the steps agents follow during a deal analysis call. Drag to reorder. Each step can include talking-point notes visible to the agent.</p>

                            {{-- Item list --}}
                            <div id="analysis-script-items" class="list-group mb-3">
                                @php
                                    $existingItems = $analysisScript?->items ?? collect();
                                @endphp
                                @foreach($existingItems->sortBy('position') as $item)
                                    @include('lead-settings.partials.analysis-script-item', ['item' => $item])
                                @endforeach
                            </div>

                            {{-- Add item dropdown --}}
                            <div class="dropdown mb-3">
                                <button class="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" id="addAnalysisItemDropdown" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                    <i class="fa fa-plus mr-1"></i> Add Step
                                </button>
                                <div class="dropdown-menu analysis-add-dropdown" aria-labelledby="addAnalysisItemDropdown" style="max-height:320px;overflow-y:auto;min-width:260px;">
                                    @if($linkedCustomFieldCategories->count())
                                        <h6 class="dropdown-header">Custom Field Categories</h6>
                                        @foreach($linkedCustomFieldCategories as $cat)
                                            <a class="dropdown-item add-analysis-item" href="#"
                                                data-type="custom_field_category"
                                                data-key="{{ $cat->id }}"
                                                data-label="{{ $cat->name }}">
                                                <span class="badge badge-secondary mr-1" style="font-size:10px;">Fields</span>
                                                {{ $cat->name }}
                                            </a>
                                        @endforeach
                                        <div class="dropdown-divider"></div>
                                    @endif

                                    <h6 class="dropdown-header">Deal Fields</h6>
                                    @foreach(['name' => 'Deal Name', 'close_date' => 'Close Date', 'value' => 'Deal Value', 'category_id' => 'Deal Category'] as $key => $label)
                                        <a class="dropdown-item add-analysis-item" href="#"
                                            data-type="native_field"
                                            data-key="{{ $key }}"
                                            data-label="{{ $label }}">
                                            <span class="badge badge-primary mr-1" style="font-size:10px;">Deal</span>
                                            {{ $label }}
                                        </a>
                                    @endforeach
                                    <div class="dropdown-divider"></div>

                                    <h6 class="dropdown-header">HIBARR Fields</h6>
                                    @foreach([
                                        'interested_in' => 'Interested In',
                                        'motivation' => 'Motivation',
                                        'purchase_timeline' => 'Purchase Timeline',
                                        'budget_range' => 'Budget Range',
                                        'inspection_trip_date' => 'Inspection Trip Date',
                                        'strategy_meeting_booked' => 'Strategy Meeting Booked',
                                        'downpayment_paid' => 'Downpayment Paid',
                                    ] as $key => $label)
                                        <a class="dropdown-item add-analysis-item" href="#"
                                            data-type="hibarr_field"
                                            data-key="{{ $key }}"
                                            data-label="{{ $label }}">
                                            <span class="badge badge-info mr-1" style="font-size:10px;">HIBARR</span>
                                            {{ $label }}
                                        </a>
                                    @endforeach
                                    <div class="dropdown-divider"></div>

                                    <h6 class="dropdown-header">Lead / Contact Fields</h6>
                                    @foreach([
                                        'client_name' => 'Full Name',
                                        'client_email' => 'Email',
                                        'mobile' => 'Mobile',
                                        'cell' => 'Cell',
                                        'office' => 'Office Phone',
                                        'company_name' => 'Company',
                                        'address' => 'Address',
                                        'city' => 'City',
                                        'state' => 'State',
                                        'country' => 'Country',
                                        'postal_code' => 'Postal Code',
                                    ] as $key => $label)
                                        <a class="dropdown-item add-analysis-item" href="#"
                                            data-type="lead_field"
                                            data-key="{{ $key }}"
                                            data-label="{{ $label }}">
                                            <span class="badge badge-warning mr-1" style="font-size:10px;">Lead</span>
                                            {{ $label }}
                                        </a>
                                    @endforeach
                                    <div class="dropdown-divider"></div>

                                    <h6 class="dropdown-header">Prompts &amp; Instructions</h6>
                                    <a class="dropdown-item" href="#" id="add-question-item">
                                        <span class="badge badge-dark mr-1" style="font-size:10px;background:#7c3aed;">Question</span>
                                        Add a question to ask the lead
                                    </a>
                                    <a class="dropdown-item" href="#" id="add-instruction-item">
                                        <span class="badge badge-dark mr-1" style="font-size:10px;">Instruction</span>
                                        Add an instruction / talking point
                                    </a>
                                </div>
                            </div>

                            {{-- Save script button --}}
                            <button type="button" id="save-analysis-script" class="btn btn-primary btn-sm">
                                <i class="fa fa-check mr-1"></i> Save Analysis Script
                            </button>
                            <span id="analysis-script-saved" class="text-success ml-2 d-none f-12"><i class="fa fa-check-circle mr-1"></i>Saved</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>

    <div class="modal-footer">
        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
        @if(!$pipeline->default)
            <x-forms.button-secondary type="button" class="delete-pipeline-from-modal text-danger border-danger">
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

    $('#hide_all_categories').on('change', function() {
        var checked = $(this).is(':checked');
        var selectionEl = document.getElementById('pipelineCategoriesSelection');
        $(selectionEl).toggleClass('opacity-50', checked);
        // `inert` (not pointer-events) so disabled category pills also can't
        // receive keyboard focus, and the search dropdown (portaled to <body>
        // on open) never gets a chance to open in the first place.
        selectionEl.inert = checked;
    });

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

    // ── Analysis Script ──────────────────────────────────────────────────────

    var BADGE_MAP = {
        custom_field_category: '<span class="badge badge-secondary" style="font-size:10px;">Fields</span>',
        native_field:          '<span class="badge badge-primary"   style="font-size:10px;">Deal</span>',
        hibarr_field:          '<span class="badge badge-info"      style="font-size:10px;">HIBARR</span>',
        lead_field:            '<span class="badge badge-warning"   style="font-size:10px;">Lead</span>',
        question:              '<span class="badge" style="font-size:10px;background:#7c3aed;color:#fff;">Question</span>',
        instruction:           '<span class="badge badge-dark"      style="font-size:10px;">Instruction</span>',
    };

    function makeItemRow(type, key, label, labelOverride, guideText) {
        labelOverride = labelOverride || '';
        guideText     = guideText     || '';
        var isPrompt  = (type === 'question' || type === 'instruction');
        var guideOpen = (guideText || isPrompt) ? 'show' : '';
        var badge     = BADGE_MAP[type] || '';
        var guidePlaceholder = type === 'question'
            ? 'Enter the question to ask the lead…'
            : (type === 'instruction' ? 'Enter the instruction or talking point…' : 'Agent talking points / script for this step…');
        var toggleLink = isPrompt ? '' : '<a href="#" class="toggle-guide-text f-11 text-muted mt-1 d-inline-block">' + (guideText ? '▲ Hide talking points' : '▼ Add talking points') + '</a>';
        return '<div class="d-flex align-items-start p-2 bg-white border rounded mb-2 analysis-item-row" data-type="' + type + '" data-key="' + key + '" style="gap:8px;">'
            + '<span class="drag-handle text-lightest mt-1 cursor-move" style="font-size:16px;line-height:1;">&#9776;</span>'
            + '<div class="flex-grow-1" style="min-width:0;">'
                + '<div class="d-flex align-items-center mb-1" style="gap:6px;">'
                    + badge
                    + '<span class="f-12 text-dark font-weight-semibold item-key-label">' + $('<span>').text(label || key).html() + '</span>'
                + '</div>'
                + '<input type="text" class="form-control form-control-sm item-label-override mb-1" placeholder="' + (isPrompt ? 'Step title (optional)' : 'Label (leave blank for default)') + '" value="' + $('<span>').text(labelOverride).html() + '" style="font-size:12px;">'
                + '<div class="collapse analysis-guide-collapse ' + guideOpen + '">'
                    + '<textarea class="form-control form-control-sm item-guide-text mt-1" rows="' + (isPrompt ? 4 : 3) + '" placeholder="' + guidePlaceholder + '" style="font-size:12px;resize:vertical;">' + $('<span>').text(guideText).html() + '</textarea>'
                + '</div>'
                + toggleLink
            + '</div>'
            + '<button type="button" class="btn btn-link text-danger p-0 remove-analysis-item" title="Remove" style="font-size:14px;line-height:1;"><i class="fa fa-times"></i></button>'
            + '</div>';
    }

    // Add item from dropdown
    $('body').off('click.addAnalysis', '.add-analysis-item').on('click.addAnalysis', '.add-analysis-item', function(e) {
        e.preventDefault();
        var type  = $(this).data('type');
        var key   = $(this).data('key').toString();
        var label = $(this).data('label');
        $('#analysis-script-items').append(makeItemRow(type, key, label, '', ''));
    });

    $('body').off('click.addQuestion', '#add-question-item').on('click.addQuestion', '#add-question-item', function(e) {
        e.preventDefault();
        $('#analysis-script-items').append(makeItemRow('question', 'q_' + Date.now(), 'New Question', '', ''));
        $('.analysis-add-dropdown').removeClass('show');
    });

    $('body').off('click.addInstruction', '#add-instruction-item').on('click.addInstruction', '#add-instruction-item', function(e) {
        e.preventDefault();
        $('#analysis-script-items').append(makeItemRow('instruction', 'i_' + Date.now(), 'New Instruction', '', ''));
        $('.analysis-add-dropdown').removeClass('show');
    });

    // Remove item
    $('body').off('click.removeAnalysis', '.remove-analysis-item').on('click.removeAnalysis', '.remove-analysis-item', function() {
        $(this).closest('.analysis-item-row').remove();
    });

    // Toggle guide text textarea
    $('body').off('click.toggleGuide', '.toggle-guide-text').on('click.toggleGuide', '.toggle-guide-text', function(e) {
        e.preventDefault();
        var $row = $(this).closest('.analysis-item-row');
        var $collapse = $row.find('.analysis-guide-collapse');
        $collapse.toggleClass('show');
        $(this).text($collapse.hasClass('show') ? '▲ Hide talking points' : '▼ Add talking points');
    });

    // Save analysis script
    $('body').off('click.saveScript', '#save-analysis-script').on('click.saveScript', '#save-analysis-script', function() {
        var items = [];
        $('#analysis-script-items .analysis-item-row').each(function(i) {
            items.push({
                type:           $(this).data('type'),
                item_key:       $(this).data('key').toString(),
                label_override: $(this).find('.item-label-override').val().trim() || null,
                guide_text:     $(this).find('.item-guide-text').val().trim()     || null,
                position:       i,
            });
        });

        var $btn = $(this);
        $btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin mr-1"></i> Saving…');

        $.ajax({
            url:         "{{ route('pipeline.analysis-script.upsert', $pipeline->id) }}",
            type:        'PUT',
            contentType: 'application/json',
            headers:     { 'X-CSRF-TOKEN': "{{ csrf_token() }}", 'Accept': 'application/json' },
            data:        JSON.stringify({ items: items }),
            success: function(resp) {
                $btn.prop('disabled', false).html('<i class="fa fa-check mr-1"></i> Save Analysis Script');
                if (resp.status === 'success') {
                    $('#analysis-script-saved').removeClass('d-none');
                    setTimeout(function() { $('#analysis-script-saved').addClass('d-none'); }, 3000);
                }
            },
            error: function() {
                $btn.prop('disabled', false).html('<i class="fa fa-check mr-1"></i> Save Analysis Script');
                toastr.error('Failed to save analysis script.');
            }
        });
    });

    // Drag-to-reorder. jQuery UI is not in the global bundle on this page, so it's
    // loaded on demand — and this runs LAST, after every handler above is bound.
    // Previously $.fn.sortable was called first and threw, aborting the whole
    // script block: no handler bound, so clicking a step just followed href="#"
    // and looked like a page reload that changed nothing.
    function initAnalysisSortable() {
        if (!$.fn.sortable) return;
        $('#analysis-script-items').sortable({ handle: '.drag-handle', tolerance: 'pointer' });
    }

    if ($.fn.sortable) {
        initAnalysisSortable();
    } else {
        $.getScript("{{ asset('vendor/jquery/jquery-ui.min.js') }}")
            .done(initAnalysisSortable)
            .fail(function() {
                // Reordering unavailable; adding, editing and saving still work.
                $('#analysis-script-items .drag-handle').css('opacity', 0.3).attr(
                    'title', 'Drag reordering unavailable — could not load jQuery UI'
                );
            });
    }

    $('body').off('click.deletePipelineModal', '.delete-pipeline-from-modal').on('click.deletePipelineModal', '.delete-pipeline-from-modal', function() {
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
