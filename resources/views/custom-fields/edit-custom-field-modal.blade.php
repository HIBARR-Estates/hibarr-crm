<div class="modal-header">
    <h5 class="modal-title">@lang('modules.customFields.editField')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <!-- Tabs Navigation -->
        <ul class="nav nav-tabs mb-3" id="customFieldTabs" role="tablist">
            <li class="nav-item" role="presentation">
                <a class="nav-link active" id="basic-tab" data-toggle="tab" href="#basic" role="tab" aria-controls="basic" aria-selected="true">
                    @lang('modules.customFields.basic_info')
                </a>
            </li>
            <li class="nav-item" role="presentation">
                <a class="nav-link" id="visibility-tab" data-toggle="tab" href="#visibility" role="tab" aria-controls="visibility" aria-selected="false">
                    @lang('modules.customFields.visibility_rules')
                </a>
            </li>
        </ul>

        <!-- Tabs Content -->
        <div class="tab-content" id="customFieldTabsContent">
            <!-- Basic Info Tab -->
            <div class="tab-pane fade show active" id="basic" role="tabpanel" aria-labelledby="basic-tab">
                <x-form id="editForm" method="PUT" class="form-horizontal">

            <div class="row">
                <input type="hidden" name="id" value="{{ $field->id }}" />
                <input type="hidden" name="module" value="{{ $field->custom_field_group_id }}" />
                <div class="col-md-4">
                    <div class="form-group my-3">
                        <label class="control-label required" for="display_name">@lang('app.module')</label>
                        <p class="mt-2 form-control-static">{{ $field->fieldGroup->name }}</p>
                    </div>
                </div>

                <div class="col-md-4">
                    <x-forms.select fieldId="type" :fieldLabel="__('modules.customFields.fieldType')" fieldName="type" :fieldValue="$field->type" search="true">
                        @foreach ($types as $type)
                            <option value="{{ $type }}" @if ($field->type == $type) selected @endif>@lang('app.' . $type)</option>
                        @endforeach
                    </x-forms.select>
                </div>

                <div class="col-md-4">
                    <x-forms.text class="" :fieldLabel="__('modules.customFields.label')" fieldName="label" fieldId="label" :fieldValue="$field->label"
                        fieldRequired="true" />
                </div>

                <div class="col-md-4">
                    <x-forms.select fieldId="category" :fieldLabel="__('modules.customFields.category')" fieldName="category" search="true">
                        <option value="">@lang('app.select') @lang('modules.customFields.category')</option>
                    </x-forms.select>
                </div>

                <div class="col-md-4">
                    <div class="form-group my-3">
                        <label class="f-14 text-dark-grey mb-12 w-100" for="usr">@lang('app.required')</label>
                        <div class="d-flex">
                            <x-forms.radio fieldId="optionsRadios1" :fieldLabel="__('app.yes')" fieldName="required"
                                fieldValue="yes" :checked="$field->required == 'yes'">
                            </x-forms.radio>
                            <x-forms.radio fieldId="optionsRadios2" :fieldLabel="__('app.no')" fieldValue="no"
                                fieldName="required" :checked="$field->required == 'no'"></x-forms.radio>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="form-group my-5">
                        <x-forms.checkbox fieldId="visible" :fieldLabel="__('modules.customFields.showInTable')" fieldName="visible" fieldValue="true"
                            :checked="$field->visible == 'true'" />
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="form-group my-5">
                        <x-forms.checkbox fieldId="export" :fieldLabel="__('modules.customFields.export')" fieldName="export" fieldValue="1"
                            :checked="$field->export == 1" />
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="form-group my-5">
                        <x-forms.checkbox fieldId="important" :fieldLabel="__('app.important')" fieldName="important" fieldValue="1"
                            :checked="$field->important == 1" />
                    </div>
                </div>
                <div class="col-md-4">
                    <x-forms.number class="" :fieldLabel="__('modules.customFields.displayOrder')" fieldName="display_order" fieldId="display_order" 
                        :fieldValue="$field->display_order ?? 0" :fieldPlaceholder="__('modules.customFields.displayOrderPlaceholder')" />
                </div>
               
            </div>
            @php
                $valueOptions = in_array($field->type, ['select','radio','checkbox']) ? (is_array($field->values) ? $field->values : []) : [];
            @endphp
            <div class="form-group mt-repeater" @if ($field->type != 'radio' && $field->type != 'select' && $field->type != 'checkbox') style="display: none;" @endif>
                @foreach ($valueOptions as $item)
                    <div id="addMoreBox{{ $loop->iteration }}" class="row mt-2">
                        <div class="col-md-10">
                            <div class="form-group">
                                <label class="control-label">@lang('app.value')</label>
                                <input class="form-control height-35 f-14" name="value[]" type="text"
                                    value="{{ is_string($item) ? $item : '' }}" placeholder="" />
                            </div>
                        </div>
                        @if ($loop->iteration !== 1)
                            <div class="col-md-1">
                                <div class="task_view mt-4"> <a href="javascript:;"
                                        class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle"
                                        onclick="removeBox({{ $loop->iteration }})"> <i
                                            class="fa fa-trash icons mr-2"></i> @lang('app.delete')</a> </div>
                            </div>
                        @endif
                    </div>
                @endforeach

                <div id="insertBefore"></div>
                <div class="row">
                    <div class="col-md-12 mt-4">

                        <a class="f-15 f-w-500" href="javascript:;" data-repeater-create id="plusButton"><i
                                class="icons icon-plus font-weight-bold mr-1"></i>@lang('modules.invoices.addItem')</a>
                    </div>
                </div>
            </div>

            <div class="form-group mt-repeater-repeatable" @if ($field->type != 'repeatable') style="display: none;" @endif>
                <label class="control-label">@lang('modules.customFields.linkedField')</label>
                <select name="linked_field_id" class="form-control select-picker" id="linkedFieldId">
                    <option value="">@lang('app.select') @lang('modules.customFields.linkedField')</option>
                    @foreach ($otherFields as $of)
                        <option value="{{ $of->id }}" @if ($field->linked_field_id == $of->id) selected @endif>{{ $of->label }} ({{ $of->type }})</option>
                    @endforeach
                </select>
                <label class="control-label mt-3">@lang('modules.customFields.itemSchema')</label>
                <div id="schemaContainer">
                    @php
                        $schemaRows = ($field->type == 'repeatable' && is_array($field->values)) ? $field->values : [];
                        $schemaTypeOptions = collect($schemaTypes ?? [])->map(fn ($t) => ['value' => $t, 'label' => __("app.{$t}")])->values()->all();
                    @endphp
                    @foreach ($schemaRows as $idx => $row)
                        <div class="row mt-2 schema-row" id="schemaRow{{ $idx }}" data-index="{{ $idx }}">
                            <div class="col-md-3">
                                <input class="form-control height-35 f-14" name="value[{{ $idx }}][key]" type="text"
                                    value="{{ $row['key'] ?? '' }}" placeholder="key" />
                            </div>
                            <div class="col-md-3">
                                <select class="form-control height-35 f-14" name="value[{{ $idx }}][type]">
                                    @foreach ($schemaTypeOptions as $opt)
                                        <option value="{{ $opt['value'] }}" @if (($row['type'] ?? '') == $opt['value']) selected @endif>{{ $opt['label'] }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <div class="col-md-4">
                                <input class="form-control height-35 f-14" name="value[{{ $idx }}][label]" type="text"
                                    value="{{ $row['label'] ?? '' }}" placeholder="Label" />
                            </div>
                            <div class="col-md-1">
                                <a href="javascript:;" class="task_view_more d-flex align-items-center mt-2" onclick="removeSchemaRow({{ $idx }})"><i class="fa fa-trash"></i></a>
                            </div>
                        </div>
                    @endforeach
                </div>
                <div id="schemaInsertBefore"></div>
                <div class="row mt-3">
                    <div class="col-md-12">
                        <a class="f-15 f-w-500" href="javascript:;" id="addSchemaRow"><i class="icons icon-plus font-weight-bold mr-1"></i>@lang('modules.customFields.addSchemaRow')</a>
                    </div>
                </div>
                @php
                    $displayConfig = $field->display_config ?? [];
                    $schemaRowsForKeys = ($field->type == 'repeatable' && is_array($field->values)) ? $field->values : [];
                @endphp
                <div class="mt-4 pt-3 border-top display-config-repeatable">
                    <label class="control-label f-w-500">@lang('modules.customFields.displayConfig')</label>
                    <div class="row mt-2">
                        <div class="col-md-12">
                            <input type="hidden" name="display_config[useDefaultDisplay]" value="0" />
                            <x-forms.checkbox fieldId="display_config_use_default"
                                :fieldLabel="__('modules.customFields.useDefaultDisplay')" fieldName="display_config[useDefaultDisplay]"
                                fieldValue="1" :checked="!empty($displayConfig['useDefaultDisplay'])" />
                        </div>
                    </div>
                    <div class="row mt-2">
                        <div class="col-md-6">
                            <label class="control-label">@lang('modules.customFields.aggregateFieldKey')</label>
                            <select name="display_config[fieldKey]" class="form-control select-picker" id="displayConfigFieldKey">
                                <option value="">@lang('app.select')</option>
                                @foreach ($schemaRowsForKeys as $row)
                                    <option value="{{ $row['key'] ?? '' }}" @if (($displayConfig['fieldKey'] ?? '') == ($row['key'] ?? '')) selected @endif>{{ $row['label'] ?? $row['key'] ?? '' }} ({{ $row['key'] ?? '' }})</option>
                                @endforeach
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="control-label">@lang('modules.customFields.aggregateBy')</label>
                            <select name="display_config[aggregateBy]" class="form-control select-picker" id="displayConfigAggregateBy">
                                <option value="first" @if (($displayConfig['aggregateBy'] ?? '') == 'first') selected @endif>@lang('modules.customFields.aggregateByFirst')</option>
                                <option value="last" @if (($displayConfig['aggregateBy'] ?? '') == 'last') selected @endif>@lang('modules.customFields.aggregateByLast')</option>
                                <option value="concat" @if (($displayConfig['aggregateBy'] ?? 'concat') == 'concat') selected @endif>@lang('modules.customFields.aggregateByConcat')</option>
                                <option value="list" @if (($displayConfig['aggregateBy'] ?? '') == 'list') selected @endif>@lang('modules.customFields.aggregateByList')</option>
                                <option value="sum" @if (($displayConfig['aggregateBy'] ?? '') == 'sum') selected @endif>@lang('modules.customFields.aggregateBySum')</option>
                                <option value="sum_currency" @if (($displayConfig['aggregateBy'] ?? '') == 'sum_currency') selected @endif>@lang('modules.customFields.aggregateBySumCurrency')</option>
                                <option value="count" @if (($displayConfig['aggregateBy'] ?? '') == 'count') selected @endif>@lang('modules.customFields.aggregateByCount')</option>
                            </select>
                        </div>
                    </div>
                    <div class="row mt-2">
                        <div class="col-md-6">
                            <x-forms.text :fieldLabel="__('modules.customFields.displayConfigSeparator')" fieldName="display_config[separator]"
                                fieldId="display_config_separator" :fieldValue="$displayConfig['separator'] ?? ''"
                                :fieldPlaceholder="', '" />
                        </div>
                        <div class="col-md-6">
                            <x-forms.text :fieldLabel="__('modules.customFields.displayConfigFormat')" fieldName="display_config[format]"
                                fieldId="display_config_format" :fieldValue="$displayConfig['format'] ?? ''"
                                :fieldPlaceholder="'Total: {value}'" />
                        </div>
                    </div>
                </div>
            </div>

                </x-form>
            </div>

            <!-- Visibility Rules Tab -->
            <div class="tab-pane fade" id="visibility" role="tabpanel" aria-labelledby="visibility-tab">
                @include('custom-fields.visibility-rules-tab')
            </div>
        </div>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
    <x-forms.button-primary id="update-custom-field" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script>
    @php
        $schemaTypeOptionsJs = collect($schemaTypes ?? [])->map(fn ($t) => ['value' => $t, 'label' => __("app.{$t}")])->values()->all();
    @endphp
    var schemaTypeOptions = @json($schemaTypeOptionsJs ?? []);

    $(".select-picker").selectpicker();

    var $insertBefore = $('#insertBefore');
    var $valueOptions = @json($valueOptions ?? []);
    var $i = $valueOptions.length;

    // Add More Inputs (value[] for select/radio/checkbox)
    $('#plusButton').click(function() {
        $i = $i + 1;
        var indexs = $i + 1;
        $('<div id="addMoreBox' + indexs +
            '" class="row my-3"> <div class="col-md-10">  <label class="control-label">@lang('app.value')</label> <input class="form-control height-35 f-14" name="value[]" type="text" value="" placeholder=""/>  </div> <div class="col-md-1"> <div class="task_view mt-4"> <a href="javascript:;" class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" onclick="removeBox(' +
            indexs + ')"> <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')</a> </div> </div></div>'
        ).insertBefore($insertBefore);
    });

    // Remove fields
    function removeBox(index) {
        $('#addMoreBox' + index).remove();
    }

    var schemaIndex = {{ ($field->type == 'repeatable' && is_array($field->values)) ? count($field->values) : 0 }};

    function addSchemaRow() {
        var typeOpts = (schemaTypeOptions || []).map(function (o) {
            return '<option value="' + o.value + '">' + (o.label || o.value) + '</option>';
        }).join('');
        var html = '<div class="row mt-2 schema-row" id="schemaRow' + schemaIndex + '" data-index="' + schemaIndex + '">' +
            '<div class="col-md-3"><input class="form-control height-35 f-14" name="value[' + schemaIndex + '][key]" type="text" value="" placeholder="key" /></div>' +
            '<div class="col-md-3"><select class="form-control height-35 f-14" name="value[' + schemaIndex + '][type]">' + typeOpts + '</select></div>' +
            '<div class="col-md-4"><input class="form-control height-35 f-14" name="value[' + schemaIndex + '][label]" type="text" value="" placeholder="Label" /></div>' +
            '<div class="col-md-1"><a href="javascript:;" class="task_view_more d-flex align-items-center mt-2" onclick="removeSchemaRow(' + schemaIndex + ')"><i class="fa fa-trash"></i></a></div></div>';
        $(html).insertBefore('#schemaInsertBefore');
        schemaIndex++;
    }

    function removeSchemaRow(idx) {
        $('#schemaRow' + idx).remove();
    }

    $('#addSchemaRow').on('click', function() { addSchemaRow(); });

    $('#type').on('change', function() {
        var v = this.value;
        $('.mt-repeater input, .mt-repeater select').prop('disabled', false);
        $('.mt-repeater-repeatable input, .mt-repeater-repeatable select').prop('disabled', false);
        if (v === 'select' || v === 'radio' || v === 'checkbox') {
            $(".mt-repeater").show();
            $(".mt-repeater-repeatable").hide();
            $('.mt-repeater-repeatable input, .mt-repeater-repeatable select').prop('disabled', true);
        } else if (v === 'repeatable') {
            $(".mt-repeater").hide();
            $(".mt-repeater-repeatable").show();
            $('.mt-repeater input, .mt-repeater select').prop('disabled', true);
        } else {
            $(".mt-repeater").hide();
            $(".mt-repeater-repeatable").hide();
            $('.mt-repeater input, .mt-repeater select').prop('disabled', true);
            $('.mt-repeater-repeatable input, .mt-repeater-repeatable select').prop('disabled', true);
        }
    });

    function convertToSlug(Text) {
        return Text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
    }

    $('#label').keyup(function() {
        $('#name').val(convertToSlug($(this).val()));
    });

    $('#update-custom-field').click(function() {
        $.easyAjax({
            url: "{{ route('custom-fields.update', $field->id) }}",
            container: '#editForm',
            type: "POST",
            data: $('#editForm').serialize(),
            file: true,
            blockUI: true,
            buttonSelector: "#update-custom-field",
            success: function(response) {
                if (response.status == 'success') {
                    window.location.reload();
                }
            }
        })
    });

    // Function to load categories for a specific module
    function loadCategoriesForModule(moduleId, selectedCategoryId = null) {
        if (moduleId) {
            // Show loading state
            var categorySelect = $('#category');
            categorySelect.empty();
            categorySelect.append('<option value="">@lang('app.loading')...</option>');
            categorySelect.selectpicker('refresh');

            $.easyAjax({
                url: "{{ route('custom-field-categories.get-by-group') }}",
                type: "GET",
                data: {
                    custom_field_group_id: moduleId
                },
                success: function(response) {
                    categorySelect.empty();
                    categorySelect.append(
                        '<option value="">@lang('app.select') @lang('modules.customFields.category')</option>');

                    if (response.categories && response.categories.length > 0) {
                        $.each(response.categories, function(index, category) {
                            var selected = (selectedCategoryId && category.id ==
                                selectedCategoryId) ? 'selected' : '';
                            categorySelect.append('<option value="' + category.id + '" ' +
                                selected + '>' + category.name + '</option>');
                        });
                    }

                    // Refresh the select picker
                    categorySelect.selectpicker('refresh');
                },
                error: function() {
                    categorySelect.empty();
                    categorySelect.append(
                        '<option value="">@lang('app.select') @lang('modules.customFields.category')</option>');
                    categorySelect.selectpicker('refresh');
                }
            });
        } else {
            // Clear categories if no module is selected
            var categorySelect = $('#category');
            categorySelect.empty();
            categorySelect.append('<option value="">@lang('app.select') @lang('modules.customFields.category')</option>');
            categorySelect.selectpicker('refresh');
        }
    }

    // Load categories when modal opens (with the current field's category selected)
    $(document).ready(function() {
        var selectedModule = '{{ $field->custom_field_group_id }}';
        var selectedCategory = '{{ $field->custom_field_category_id }}';
        if (selectedModule) {
            loadCategoriesForModule(selectedModule, selectedCategory);
        }
        $('#type').trigger('change');
    });

    // Note: Module field is read-only in edit mode, so no change handler needed

    var conditionCount = {{ $field->conditions->count() }};
    
    $('#add-condition').click(function() {
        conditionCount++;
        var index = conditionCount - 1;
        var html = `
            <div class="row condition-row mb-2" id="condition-${conditionCount}">
                <div class="col-md-1 d-flex align-items-center justify-content-center">
                    <span class="condition-number font-weight-bold">${conditionCount}</span>
                </div>
                <div class="col-md-4">
                    <select name="conditions[${index}][target_field_id]" class="form-control select-picker">
                        @foreach($otherFields as $otherField)
                            <option value="{{ $otherField->id }}">{{ addslashes($otherField->label) }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="col-md-3">
                    <select name="conditions[${index}][operator]" class="form-control select-picker">
                        <option value="==">Equals</option>
                        <option value="!=">Not Equals</option>
                        <option value=">">Greater Than</option>
                        <option value="<">Less Than</option>
                        <option value="contains">Contains</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <input type="text" name="conditions[${index}][value]" class="form-control" placeholder="Value">
                </div>
                <div class="col-md-1">
                    <button type="button" class="btn btn-danger btn-sm remove-condition" onclick="removeCondition(${conditionCount})"><i class="fa fa-trash"></i></button>
                </div>
            </div>
        `;
        $('#conditions-container').append(html);
        $('.select-picker').selectpicker('refresh');
    });

    function removeCondition(id) {
        $('#condition-' + id).remove();
        // Optional: Renumber conditions or just leave gaps. 
        // If we leave gaps, the logic string must still refer to the original numbers.
        // For simplicity, we assume the user manages the logic string manually.
    }
</script>
