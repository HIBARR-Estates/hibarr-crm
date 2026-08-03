<div class="modal-header">
    <h5 class="modal-title">@lang('modules.customFields.addField')</h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>

<div class="modal-body">
    <div class="portlet-body">
        <x-form id="createForm" method="POST" class="ajax-form">
            <div class="row">

                <div class="col-lg-6">
                    <x-forms.select fieldId="module" :fieldLabel="__('app.module')" fieldName="module"
                                    search="true">
                        @foreach ($customFieldGroups as $item)
                            <option value="{{ $item->id }}">@lang('app.'.strtolower($item->name))</option>
                        @endforeach
                    </x-forms.select>
                </div>

                <div class="col-lg-6">
                    <x-forms.text :fieldLabel="__('modules.customFields.label')" fieldName="label" fieldId="label"  fieldRequired="true"  />
                </div>

                <div class="col-lg-6">
                    <x-forms.select fieldId="category" :fieldLabel="__('modules.customFields.category')" fieldName="category" search="true">
                        <option value="">@lang('app.select') @lang('modules.customFields.category')</option>
                    </x-forms.select>
                </div>

                <div class="col-lg-6">
                    <div class="form-group my-3">
                        <label class="f-14 text-dark-grey mb-12 w-100" for="usr">@lang('app.required')</label>
                        <div class="d-flex">
                            <x-forms.radio fieldId="optionsRadios1" :fieldLabel="__('app.yes')" fieldName="required"
                                           fieldValue="yes" checked="true">
                            </x-forms.radio>
                            <x-forms.radio fieldId="optionsRadios2" :fieldLabel="__('app.no')" fieldValue="no"
                                           fieldName="required"></x-forms.radio>
                        </div>
                    </div>
                </div>

                <div class="col-lg-6">
                    <x-forms.select fieldId="type"
                                    :fieldLabel="__('modules.customFields.fieldType')"
                                    fieldName="type"
                                    search="true">
                        @foreach ($types as $type)
                            <option value="{{ $type }}">@lang('app.'.$type)</option>
                        @endforeach
                    </x-forms.select>
                </div>

                <div class="col-lg-6">
                    <div class="form-group my-5">
                        <x-forms.checkbox fieldId="visible"
                        :fieldLabel="__('modules.customFields.showInTable')" fieldName="visible"
                        fieldValue="true"/>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="form-group my-5">
                    <x-forms.checkbox fieldId="export"
                        :fieldLabel="__('modules.customFields.export')" fieldName="export"
                        fieldValue="1"  />
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="form-group my-5">
                        <x-forms.checkbox fieldId="important"
                            :fieldLabel="__('app.important')" fieldName="important"
                            fieldValue="1" />
                    </div>
                </div>
                <div class="col-md-4">
                    <x-forms.number class="" :fieldLabel="__('modules.customFields.displayOrder')" fieldName="display_order" fieldId="display_order" 
                        fieldValue="0" :fieldPlaceholder="__('modules.customFields.displayOrderPlaceholder')" />
                </div>

            </div>
            <div class="form-group mt-repeater d-none">
                <div id="addMoreBox1" class="row my-3">
                    <div class="col-md-10">
                        <div class="form-group">
                            {{-- <label class="control-label" >@lang('app.value')</label> --}}
                            <x-forms.label fieldId="value" fieldRequired="true"
                                           :fieldLabel="__('app.value')">
                            </x-forms.label>
                            <input class="form-control height-35 f-14" name="value[]" type="text" value=""
                                   placeholder=""/>
                        </div>
                    </div>
                </div>
                <div id="insertBefore"></div>
                <div class="row">
                    <div class="col-md-12 mt-4">

                        <a class="f-15 f-w-500" href="javascript:;" data-repeater-create id="plusButton"><i
                                class="icons icon-plus font-weight-bold mr-1"></i>@lang('modules.invoices.addItem')</a>
                    </div>
                </div>
            </div>
            <div class="form-group mt-repeater-repeatable d-none">
                <label class="control-label">@lang('modules.customFields.linkedField')</label>
                <select name="linked_field_id" class="form-control select-picker" id="createLinkedFieldId">
                    <option value="">@lang('app.select') @lang('modules.customFields.linkedField')</option>
                </select>
                <label class="control-label mt-3">@lang('modules.customFields.itemSchema')</label>
                <div id="createSchemaContainer"></div>
                <div id="createSchemaInsertBefore"></div>
                <div class="row mt-3">
                    <div class="col-md-12">
                        <a class="f-15 f-w-500" href="javascript:;" id="createAddSchemaRow"><i class="icons icon-plus font-weight-bold mr-1"></i>@lang('modules.customFields.addSchemaRow')</a>
                    </div>
                </div>
                <div class="mt-4 pt-3 border-top display-config-repeatable">
                    <label class="control-label f-w-500">@lang('modules.customFields.displayConfig')</label>
                    <div class="row mt-2">
                        <div class="col-md-12">
                            <input type="hidden" name="display_config[useDefaultDisplay]" value="0" />
                            <x-forms.checkbox fieldId="create_display_config_use_default"
                                :fieldLabel="__('modules.customFields.useDefaultDisplay')" fieldName="display_config[useDefaultDisplay]"
                                fieldValue="1" />
                        </div>
                    </div>
                    <div class="row mt-2">
                        <div class="col-md-6">
                            <x-forms.text :fieldLabel="__('modules.customFields.aggregateFieldKey')" fieldName="display_config[fieldKey]"
                                fieldId="create_display_config_field_key" :fieldPlaceholder="'e.g. price'" />
                        </div>
                        <div class="col-md-6">
                            <label class="control-label">@lang('modules.customFields.aggregateBy')</label>
                            <select name="display_config[aggregateBy]" class="form-control select-picker" id="createDisplayConfigAggregateBy">
                                <option value="first">@lang('modules.customFields.aggregateByFirst')</option>
                                <option value="last">@lang('modules.customFields.aggregateByLast')</option>
                                <option value="concat" selected>@lang('modules.customFields.aggregateByConcat')</option>
                                <option value="list">@lang('modules.customFields.aggregateByList')</option>
                                <option value="sum">@lang('modules.customFields.aggregateBySum')</option>
                                <option value="sum_currency">@lang('modules.customFields.aggregateBySumCurrency')</option>
                                <option value="count">@lang('modules.customFields.aggregateByCount')</option>
                            </select>
                        </div>
                    </div>
                    <div class="row mt-2">
                        <div class="col-md-6">
                            <x-forms.text :fieldLabel="__('modules.customFields.displayConfigSeparator')" fieldName="display_config[separator]"
                                fieldId="create_display_config_separator" :fieldPlaceholder="', '" />
                        </div>
                        <div class="col-md-6">
                            <x-forms.text :fieldLabel="__('modules.customFields.displayConfigFormat')" fieldName="display_config[format]"
                                fieldId="create_display_config_format" :fieldPlaceholder="'Total: {value}'" />
                        </div>
                    </div>
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
    <x-forms.button-primary id="save-custom-field" icon="check">@lang('app.save')</x-forms.button-primary>
</div>

<script>
    @php
        $schemaTypeOptions = collect($schemaTypes ?? [])->map(fn ($t) => ['value' => $t, 'label' => __("app.{$t}")])->values()->all();
    @endphp
    var schemaTypeOptions = @json($schemaTypeOptions);

    $(".select-picker").selectpicker();

    var $insertBefore = $('#insertBefore');
    var $i = 1;

    // Add More Inputs
    $('#plusButton').click(function () {
        $i = $i + 1;
        var indexs = $i + 1;
        $('<div id="addMoreBox' + indexs + '" class="row my-3"> <div class="col-md-10">  <label class="control-label">@lang('app.value')</label> <input class="form-control height-35 f-14" name="value[]" type="text" value="" placeholder=""/>  </div> <div class="col-md-1"> <div class="task_view mt-4"> <a href="javascript:;" class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" onclick="removeBox(' + indexs + ')"> <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')</a> </div> </div></div>').insertBefore($insertBefore);
    });

    // Remove fields
    function removeBox(index) {
        $('#addMoreBox' + index).remove();
    }

    var createSchemaIndex = 0;
    function loadFieldsForRepeatable(moduleId) {
        var $sel = $('#createLinkedFieldId');
        $sel.empty().append('<option value="">@lang('app.select') @lang('modules.customFields.linkedField')</option>');
        if (!moduleId) { $sel.selectpicker('refresh'); return; }
        $.easyAjax({
            url: "{{ route('custom-fields.fields-by-group') }}",
            type: "GET",
            data: { group_id: moduleId },
            success: function (r) {
                $sel.empty().append('<option value="">@lang('app.select') @lang('modules.customFields.linkedField')</option>');
                if (r.fields && r.fields.length) {
                    $.each(r.fields, function (i, f) {
                        var $opt = $('<option></option>').val(f.id).text((f.label || f.name) + ' (' + (f.type || '') + ')');
                        $sel.append($opt);
                    });
                }
                $sel.selectpicker('refresh');
            },
            error: function () { $sel.selectpicker('refresh'); }
        });
    }
    function addCreateSchemaRow() {
        var typeOpts = (schemaTypeOptions || []).map(function (o) {
            return '<option value="' + o.value + '">' + (o.label || o.value) + '</option>';
        }).join('');
        var html = '<div class="row mt-2 schema-row" id="createSchemaRow' + createSchemaIndex + '">' +
            '<div class="col-md-3"><input class="form-control height-35 f-14" name="value[' + createSchemaIndex + '][key]" type="text" placeholder="key" /></div>' +
            '<div class="col-md-3"><select class="form-control height-35 f-14" name="value[' + createSchemaIndex + '][type]">' + typeOpts + '</select></div>' +
            '<div class="col-md-4"><input class="form-control height-35 f-14" name="value[' + createSchemaIndex + '][label]" type="text" placeholder="Label" /></div>' +
            '<div class="col-md-1"><a href="javascript:;" class="task_view_more d-flex align-items-center mt-2" onclick="jQuery(\'#createSchemaRow' + createSchemaIndex + '\').remove()"><i class="fa fa-trash"></i></a></div></div>';
        $(html).insertBefore('#createSchemaInsertBefore');
        createSchemaIndex++;
    }
    $('#createAddSchemaRow').on('click', function () { addCreateSchemaRow(); });

    function syncTypeDependentSections() {
        var v = $('#type').val();
        $('.mt-repeater input, .mt-repeater select').prop('disabled', false);
        $('.mt-repeater-repeatable input, .mt-repeater-repeatable select').prop('disabled', false);
        if (v === 'select' || v === 'radio' || v === 'checkbox' || v === 'multiselect') {
            $('.mt-repeater').removeClass('d-none');
            $('.mt-repeater-repeatable').addClass('d-none');
            $('.mt-repeater-repeatable input, .mt-repeater-repeatable select').prop('disabled', true);
        } else if (v === 'repeatable') {
            $('.mt-repeater').addClass('d-none');
            $('.mt-repeater-repeatable').removeClass('d-none');
            $('.mt-repeater input, .mt-repeater select').prop('disabled', true);
            loadFieldsForRepeatable($('#module').val());
        } else {
            $('.mt-repeater').addClass('d-none');
            $('.mt-repeater-repeatable').addClass('d-none');
            $('.mt-repeater input, .mt-repeater select').prop('disabled', true);
            $('.mt-repeater-repeatable input, .mt-repeater-repeatable select').prop('disabled', true);
        }
    }
    $('#type').on('change', syncTypeDependentSections);

    function convertToSlug(Text) {
        return Text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
    }

    $('#label').keyup(function () {
        $('#name').val(convertToSlug($(this).val()));
    });

    // Function to load categories for a specific module
    function loadCategoriesForModule(moduleId) {
        if (moduleId) {
            // Show loading state
            var categorySelect = $('#category');
            categorySelect.empty();
            categorySelect.append('<option value="">@lang('app.loading')...</option>');
            categorySelect.selectpicker('refresh');
            
            $.easyAjax({
                url: "{{ route('custom-field-categories.get-by-group') }}",
                type: "GET",
                data: { custom_field_group_id: moduleId },
                success: function (response) {
                    categorySelect.empty();
                    categorySelect.append('<option value="">@lang('app.select') @lang('modules.customFields.category')</option>');
                    
                    if (response.categories && response.categories.length > 0) {
                        $.each(response.categories, function(index, category) {
                            categorySelect.append('<option value="' + category.id + '">' + category.name + '</option>');
                        });
                    }
                    
                    // Refresh the select picker
                    categorySelect.selectpicker('refresh');
                },
                error: function() {
                    categorySelect.empty();
                    categorySelect.append('<option value="">@lang('app.select') @lang('modules.customFields.category')</option>');
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

    // Load categories when module changes
    $('#module').on('change', function() {
        var moduleId = $(this).val();
        loadCategoriesForModule(moduleId);
        if ($('#type').val() === 'repeatable') loadFieldsForRepeatable(moduleId);
    });

    // Load categories and type-dependent sections when modal opens (if module/type pre-selected)
    $(document).ready(function() {
        var selectedModule = $('#module').val();
        if (selectedModule) {
            loadCategoriesForModule(selectedModule);
        }
        syncTypeDependentSections();
    });

    $('#save-custom-field').click(function () {
        $.easyAjax({
            url: "{{route('custom-fields.store')}}",
            container: '#createForm',
            type: "POST",
            data: $('#createForm').serialize(),
            file: true,
            blockUI: true,
            buttonSelector: "#save-custom-field",
            success: function (response) {
                if (response.status === 'success') {
                    window.location.reload();
                }
            }
        })
        return false;
    })

</script>

