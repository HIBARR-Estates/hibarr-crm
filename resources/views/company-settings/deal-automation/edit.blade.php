@extends('layouts.app')

@section('content')

    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        @lang($pageTitle)
                    </h2>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
                @if(isset($automation->id))
                    <input type="hidden" name="_form_action" id="form-action-url" value="{{ route('deal-automations.update', $automation->id) }}">
                    <input type="hidden" name="_form_method" id="form-method" value="PUT">
                @else
                    <input type="hidden" name="_form_action" id="form-action-url" value="{{ route('deal-automations.store') }}">
                    <input type="hidden" name="_form_method" id="form-method" value="POST">
                @endif

                <div class="alert alert-info mb-4">
                    <h5 class="alert-heading f-14 font-weight-bold"><i class="fa fa-info-circle"></i> How Automations Work</h5>
                    <p class="mb-0 f-13">
                        This rule runs only when the selected trigger event happens. It does not lock the deal state. 
                        If a user manually moves a deal, this automation will not revert it unless a new event triggers the rule again.
                    </p>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <x-forms.text fieldId="name" :fieldLabel="__('app.name')" fieldName="name" fieldRequired="true"
                            :fieldValue="$automation->name ?? ''" />
                    </div>
                    <div class="col-md-3">
                        <x-forms.number fieldId="priority" :fieldLabel="__('Priority')" fieldName="priority" fieldRequired="true"
                            :fieldValue="$automation->priority ?? 0" fieldHelp="Higher number runs first" />
                    </div>
                    <div class="col-md-3">
                        <div class="form-group my-3">
                            <x-forms.checkbox fieldId="active" :fieldLabel="__('app.active')" fieldName="active"
                                :checked="$automation->active ?? true" />
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <x-forms.select fieldId="pipeline_id" :fieldLabel="__('Pipeline Scope')" fieldName="pipeline_id" fieldRequired="true">
                            @foreach($pipelines as $pipeline)
                                <option value="{{ $pipeline->id }}" {{ ($automation->pipeline_id ?? '') == $pipeline->id ? 'selected' : '' }}>
                                    {{ $pipeline->name }}
                                </option>
                            @endforeach
                        </x-forms.select>
                    </div>
                    <div class="col-md-6">
                        <x-forms.select fieldId="trigger" :fieldLabel="__('Trigger (Optional)')" fieldName="trigger">
                            <option value="">-- Run on Any Update --</option>
                            <option value="deal_created" {{ ($automation->trigger ?? '') == 'deal_created' ? 'selected' : '' }}>Deal Created</option>
                            <option value="deal_updated" {{ ($automation->trigger ?? '') == 'deal_updated' ? 'selected' : '' }}>Deal Updated</option>
                            <option value="followup_created" {{ ($automation->trigger ?? '') == 'followup_created' ? 'selected' : '' }}>Follow-up Created</option>
                            <option value="custom_field_updated" {{ ($automation->trigger ?? '') == 'custom_field_updated' ? 'selected' : '' }}>Custom Field Updated</option>
                        </x-forms.select>
                        <p class="f-11 text-lightest mt-1" id="trigger-help-text">
                            @if(($automation->trigger ?? '') == '')
                                Evaluates whenever a deal is created or updated.
                            @elseif(($automation->trigger ?? '') == 'deal_created')
                                Evaluates only when a new deal is created.
                            @elseif(($automation->trigger ?? '') == 'deal_updated')
                                Evaluates when a deal's properties are updated.
                            @elseif(($automation->trigger ?? '') == 'followup_created')
                                Evaluates when a follow-up is added to the deal.
                            @elseif(($automation->trigger ?? '') == 'custom_field_updated')
                                Evaluates when a custom field value changes.
                            @endif
                        </p>
                        <div id="trigger-warning" class="alert alert-warning f-13 mt-2 p-2" style="display: none;">
                            <i class="fa fa-exclamation-triangle"></i> <strong>Note:</strong> This rule evaluates every time a deal is saved. Ensure your conditions are specific to avoid unintended stage changes.
                        </div>
                    </div>
                </div>

                <hr>
                <h4 class="mb-3">Conditions</h4>
                <div id="conditions-container">
                    @if(isset($automation) && $automation->conditions->count() > 0)
                        @foreach($automation->conditions as $index => $condition)
                            @include('company-settings.deal-automation.condition-row', ['index' => $index, 'condition' => $condition])
                        @endforeach
                    @else
                        @include('company-settings.deal-automation.condition-row', ['index' => 0, 'condition' => null])
                    @endif
                </div>
                <button type="button" class="btn btn-sm btn-secondary mt-2" id="add-condition"><i class="fa fa-plus"></i> Add Condition</button>

                <hr>
                <h4 class="mb-3">Actions</h4>
                <div id="actions-container">
                    @if(isset($automation) && $automation->actions->count() > 0)
                        @foreach($automation->actions as $index => $action)
                            @include('company-settings.deal-automation.action-row', ['index' => $index, 'action' => $action])
                        @endforeach
                    @else
                        @include('company-settings.deal-automation.action-row', ['index' => 0, 'action' => null])
                    @endif
                </div>
                <button type="button" class="btn btn-sm btn-secondary mt-2" id="add-action"><i class="fa fa-plus"></i> Add Action</button>

            </div>

            <x-slot name="action">
                <div class="w-100 border-top-grey">
                    <x-setting-form-actions>
                        <x-forms.button-primary id="save-automation" icon="check">@lang('app.save')</x-forms.button-primary>
                        <x-forms.button-cancel :link="route('company-settings.deal_automations')" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
                    </x-setting-form-actions>
                </div>
            </x-slot>

        </x-setting-card>

    </div>

    {{-- Templates for JS --}}
    <script type="text/template" id="condition-template">
        @include('company-settings.deal-automation.condition-row', ['index' => 'INDEX', 'condition' => null])
    </script>
    <script type="text/template" id="action-template">
        @include('company-settings.deal-automation.action-row', ['index' => 'INDEX', 'action' => null])
    </script>

@endsection

@push('scripts')
    <script>
        $(document).ready(function() {
            let conditionIndex = {{ isset($automation) ? $automation->conditions->count() : 1 }};
            let actionIndex = {{ isset($automation) ? $automation->actions->count() : 1 }};

            $('#add-condition').click(function() {
                let template = $('#condition-template').html();
                template = template.replace(/INDEX/g, conditionIndex);
                $('#conditions-container').append(template);
                conditionIndex++;
            });

            $('#add-action').click(function() {
                let template = $('#action-template').html();
                template = template.replace(/INDEX/g, actionIndex);
                $('#actions-container').append(template);
                actionIndex++;
            });

            $('body').on('click', '.remove-row', function() {
                $(this).closest('.row').remove();
            });

            // Trigger Help Text Logic
            const triggerHelp = {
                '': 'Evaluates whenever a deal is created or updated.',
                'deal_created': 'Evaluates only when a new deal is created.',
                'deal_updated': 'Evaluates when a deal\'s properties are updated.',
                'followup_created': 'Evaluates when a follow-up is added to the deal.',
                'custom_field_updated': 'Evaluates when a custom field value changes.'
            };

            $('#trigger').change(function() {
                const val = $(this).val();
                $('#trigger-help-text').text(triggerHelp[val] || '');
                
                if (val === 'deal_updated') {
                    $('#trigger-warning').slideDown();
                } else {
                    $('#trigger-warning').slideUp();
                }
            });


            // Condition Builder Logic
            function updateConditionValueInput(row) {
                const fieldSelect = row.find('.condition-field-select');
                const operatorSelect = row.find('.condition-operator-select');
                const valueContainer = row.find('.condition-value-container');
                const existingInput = valueContainer.find('input, select');
                // Get current value - check value attribute for initial load if val() is empty/default
                let currentValue = existingInput.val();
                if (currentValue === undefined || currentValue === null) currentValue = existingInput.attr('value');
                
                // Get base name for the input (handling array index)
                // We look for name="conditions[X][value]"
                let inputName = existingInput.attr('name');
                if (!inputName) {
                    // Try to construct from row index if we lost the element
                    // This is a fail-safe, normally shouldn't happen if we replace correctly
                    const index = row.index(); // Note: this index might be offset if there are other rows in container
                    // better to rely on finding the name from the input before we destroy it
                    // If we already destroyed it (hidden state?), we need a way to recover.
                    // Actually, for "exists" operator we might have replaced it with hidden input.
                    // Let's assume the name is always on the first child of valueContainer
                }

                const selectedOption = fieldSelect.find('option:selected');
                const fieldType = selectedOption.data('type') || 'string';
                const fieldValues = selectedOption.data('values'); // Expecting array or null
                
                const operator = operatorSelect.val();

                // 1. Handle "Exists" / "Changed" operators -> Hide value input
                if (operator === 'exists' || operator === 'changed') {
                     if (!existingInput.is('input[type="hidden"]')) {
                         const hiddenHtml = `<input type="hidden" name="${inputName}" value="__ANY__"> <span class="text-muted f-12 align-middle mt-2 d-inline-block">N/A</span>`;
                         valueContainer.html(hiddenHtml);
                     }
                     return;
                }

                // 2. Handle "Boolean" type
                if (fieldType === 'boolean') {
                    if (!existingInput.is('select') || existingInput.find('option[value="1"]').length === 0) {
                        let html = `<select name="${inputName}" class="form-control height-35 f-14">
                            <option value="1" ${currentValue == '1' ? 'selected' : ''}>True / Yes</option>
                            <option value="0" ${currentValue == '0' ? 'selected' : ''}>False / No</option>
                        </select>`;
                        valueContainer.html(html);
                    }
                    return;
                }

                // 3. Handle "Select" type (Custom Field Dropdown)
                if (fieldType === 'select' && fieldValues) {
                     // Check if we already have a select with these values to avoid re-rendering (optional optimization)
                     // Re-rendering is safer to ensure options match
                     let html = `<select name="${inputName}" class="form-control height-35 f-14">`;
                     html += `<option value="">-- Select --</option>`;
                     
                     let options = fieldValues;
                     if (typeof options === 'string') {
                         try { options = JSON.parse(options); } catch(e) {}
                     }

                     if (Array.isArray(options)) {
                         options.forEach(opt => {
                             // Handle simple array ["A", "B"] or object array [{"value":"A", "label":"A"}]? 
                             // Usually simple array for 'values' column
                             let val = (typeof opt === 'object') ? opt.value : opt;
                             let label = (typeof opt === 'object') ? opt.label : opt;
                             html += `<option value="${val}" ${currentValue == val ? 'selected' : ''}>${label}</option>`;
                         });
                     } else if(typeof options === 'object' && options !== null) {
                          for(const [key, val] of Object.entries(options)) {
                              html += `<option value="${val}" ${currentValue == val ? 'selected' : ''}>${val}</option>`;
                          }
                     }
                     html += `</select>`;
                     valueContainer.html(html);
                     return;
                }
                
                // 4. Handle "Date" type
                if (fieldType === 'date') {
                     if (!existingInput.is('input[type="date"]')) {
                        valueContainer.html(`<input type="date" name="${inputName}" class="form-control height-35 f-14" value="${currentValue || ''}">`);
                     }
                     return;
                }

                // 5. Default: Text Input (String, Number, etc)
                if (!existingInput.is('input[type="text"]') && !existingInput.is('input[type="number"]')) {
                     // restore text input
                     const typeProp = fieldType === 'number' ? 'number' : 'text';
                     valueContainer.html(`<input type="${typeProp}" name="${inputName}" class="form-control height-35 f-14" value="${currentValue !== '__ANY__' ? (currentValue || '') : ''}" placeholder="Value">`);
                }
            }

            function updateOperators(row) {
                const fieldSelect = row.find('.condition-field-select');
                const operatorSelect = row.find('.condition-operator-select');
                const selectedOption = fieldSelect.find('option:selected');
                const fieldType = selectedOption.data('type') || 'string';

                operatorSelect.find('option').each(function() {
                    const supportedTypes = $(this).data('types');
                    if (supportedTypes && supportedTypes.split(',').includes(fieldType)) {
                        $(this).show();
                        $(this).prop('disabled', false);
                    } else {
                        $(this).hide();
                        $(this).prop('disabled', true);
                    }
                });

                // If currently selected operator is disabled, select the first enabled one
                if (operatorSelect.find('option:selected').prop('disabled')) {
                    operatorSelect.val(operatorSelect.find('option:not(:disabled):first').val());
                }
                
                // Also update the value input based on new operator/field
                updateConditionValueInput(row);
            }

            $('body').on('change', '.condition-field-select', function() {
                updateOperators($(this).closest('.condition-row'));
            });
            
            $('body').on('change', '.condition-operator-select', function() {
                updateConditionValueInput($(this).closest('.condition-row'));
            });

            // Initialize operators for existing rows
            $('.condition-row').each(function() {
                updateOperators($(this));
            });

            // Also initialize when adding a new row
            $('#add-condition').click(function() {
                // Wait for the row to be appended
                setTimeout(function() {
                    updateOperators($('#conditions-container .condition-row:last'));
                }, 0);
            });

            // Action Builder Logic
            function updateStageOptions(row) {
                const pipelineSelect = row.find('.action-pipeline-select');
                const stageSelect = row.find('.action-stage-select');
                let targetPipelineId = pipelineSelect.val();

                // If no target pipeline selected, use the main pipeline scope
                if (!targetPipelineId) {
                    targetPipelineId = $('#pipeline_id').val();
                }

                stageSelect.find('option').each(function() {
                    const option = $(this);
                    const optionPipelineId = option.data('pipeline-id');
                    
                    // Always show the placeholder
                    if (option.val() === "") {
                        option.show();
                        return;
                    }

                    if (optionPipelineId == targetPipelineId) {
                        option.show();
                        option.prop('disabled', false);
                    } else {
                        option.hide();
                        option.prop('disabled', true);
                    }
                });

                // If currently selected stage is now hidden/disabled, reset selection
                const selectedOption = stageSelect.find('option:selected');
                if (selectedOption.val() !== "" && (selectedOption.css('display') === 'none' || selectedOption.prop('disabled'))) {
                    stageSelect.val("");
                }
            }

            $('body').on('change', '.action-pipeline-select', function() {
                updateStageOptions($(this).closest('.action-row'));
            });

            $('#pipeline_id').change(function() {
                $('.action-row').each(function() {
                    updateStageOptions($(this));
                });
            });

            // Initialize stages for existing rows
            $('.action-row').each(function() {
                updateStageOptions($(this));
            });

            // Also initialize when adding a new row
            $('#add-action').click(function() {
                setTimeout(function() {
                    updateStageOptions($('#actions-container .action-row:last'));
                }, 0);
            });

            // Forward Only Warning Logic
            $('body').on('change', '.forward-only-check', function() {
                const container = $(this).closest('.col-md-3');
                if (!$(this).is(':checked')) {
                    container.find('.forward-only-help').hide();
                    container.find('.forward-only-warning').show();
                } else {
                    container.find('.forward-only-help').show();
                    container.find('.forward-only-warning').hide();
                }
            });
            
            // Initialize forward only warnings
            $('.forward-only-check').trigger('change');

            $('#save-automation').click(function() {
                // Get form data and replace _method with the correct one for this action
                var formData = $('#editSettings').serializeArray();
                
                // Remove any existing _method entries
                formData = formData.filter(function(item) {
                    return item.name !== '_method';
                });
                
                // Add the correct _method based on create vs update
                var method = $('#form-method').val();
                if (method === 'PUT') {
                    formData.push({ name: '_method', value: 'PUT' });
                }
                
                $.easyAjax({
                    url: $('#form-action-url').val(),
                    container: '#editSettings',
                    type: "POST",
                    disableButton: true,
                    blockUI: true,
                    buttonSelector: "#save-automation",
                    data: $.param(formData),
                    redirect: true
                })
            });
        });
    </script>
@endpush
