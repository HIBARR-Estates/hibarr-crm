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
                        This rule runs only when the selected trigger event happens. It does not lock the deal/lead state.
                        If a user manually changes it, this automation will not revert it unless a new event triggers the rule again.
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
                        <x-forms.select fieldId="subject_type" :fieldLabel="__('Automation For')" fieldName="subject_type" fieldRequired="true">
                            <option value="deal" {{ ($automation->subject_type ?? 'deal') == 'deal' ? 'selected' : '' }}>Deals</option>
                            <option value="lead" {{ ($automation->subject_type ?? 'deal') == 'lead' ? 'selected' : '' }}>Leads</option>
                        </x-forms.select>
                        <p class="f-11 text-lightest mt-1">Deal automations can move stage/lock the deal; lead automations run directly on the lead (no pipeline).</p>
                    </div>
                    <div class="col-md-6" id="pipeline-scope-col">
                        <x-forms.select fieldId="pipeline_id" :fieldLabel="__('Pipeline Scope (Optional)')" fieldName="pipeline_id">
                            <option value="">-- All Pipelines --</option>
                            @foreach($pipelines as $pipeline)
                                <option value="{{ $pipeline->id }}" {{ ($automation->pipeline_id ?? '') == $pipeline->id ? 'selected' : '' }}>
                                    {{ $pipeline->name }}
                                </option>
                            @endforeach
                        </x-forms.select>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <x-forms.select fieldId="trigger" :fieldLabel="__('Trigger (Optional)')" fieldName="trigger">
                            <option value="">-- Run on Any Update --</option>
                            <option value="deal_created" data-subject="deal" {{ ($automation->trigger ?? '') == 'deal_created' ? 'selected' : '' }}>Deal Created</option>
                            <option value="deal_updated" data-subject="deal" {{ ($automation->trigger ?? '') == 'deal_updated' ? 'selected' : '' }}>Deal Updated</option>
                            <option value="followup_created" data-subject="deal" {{ ($automation->trigger ?? '') == 'followup_created' ? 'selected' : '' }}>Follow-up Created</option>
                            <option value="custom_field_updated" data-subject="any" {{ ($automation->trigger ?? '') == 'custom_field_updated' ? 'selected' : '' }}>Custom Field Updated</option>
                            <option value="lead_created" data-subject="lead" {{ ($automation->trigger ?? '') == 'lead_created' ? 'selected' : '' }}>Lead Created</option>
                            <option value="lead_updated" data-subject="lead" {{ ($automation->trigger ?? '') == 'lead_updated' ? 'selected' : '' }}>Lead Updated</option>
                            <option value="lead_followup_created" data-subject="lead" {{ ($automation->trigger ?? '') == 'lead_followup_created' ? 'selected' : '' }}>Lead Follow-up Created</option>
                            <option value="date_based" data-subject="any" {{ ($automation->trigger ?? '') == 'date_based' ? 'selected' : '' }}>Specific Date / Birthday</option>
                        </x-forms.select>
                        <p class="f-11 text-lightest mt-1" id="trigger-help-text">
                            @if(($automation->trigger ?? '') == '')
                                Evaluates whenever the deal/lead is created or updated.
                            @elseif(($automation->trigger ?? '') == 'deal_created')
                                Evaluates only when a new deal is created.
                            @elseif(($automation->trigger ?? '') == 'deal_updated')
                                Evaluates when a deal's properties are updated.
                            @elseif(($automation->trigger ?? '') == 'followup_created')
                                Evaluates when a follow-up is added to the deal.
                            @elseif(($automation->trigger ?? '') == 'custom_field_updated')
                                Evaluates when a custom field value changes.
                            @elseif(($automation->trigger ?? '') == 'lead_created')
                                Evaluates only when a new lead is created.
                            @elseif(($automation->trigger ?? '') == 'lead_updated')
                                Evaluates when a lead's properties are updated.
                            @elseif(($automation->trigger ?? '') == 'lead_followup_created')
                                Evaluates when a follow-up or meeting is added to the lead (not to a deal).
                            @elseif(($automation->trigger ?? '') == 'date_based')
                                Runs once per matching day from the daily scheduler — pick the date field and whether it repeats every year (birthdays) or fires one time only.
                            @endif
                        </p>
                        <div id="trigger-warning" class="alert alert-warning f-13 mt-2 p-2" style="display: none;">
                            <i class="fa fa-exclamation-triangle"></i> <strong>Note:</strong> This rule evaluates every time the record is saved. Ensure your conditions are specific to avoid unintended changes.
                        </div>
                    </div>
                </div>

                {{-- Only relevant for trigger = 'date_based'; toggled by JS below --}}
                <div class="row" id="date-trigger-config" style="display: none;">
                    <div class="col-md-6">
                        <x-forms.select fieldId="trigger_date_field" :fieldLabel="__('Date Field')" fieldName="trigger_date_field" fieldRequired="true">
                            <option value="">-- Select Date --</option>
                            @include('company-settings.deal-automation._date-field-options', ['selectedDateField' => $automation->date_field ?? ''])
                        </x-forms.select>
                    </div>
                    <div class="col-md-6">
                        <x-forms.select fieldId="trigger_date_recurrence" :fieldLabel="__('Repeat')" fieldName="trigger_date_recurrence" fieldRequired="true">
                            @foreach($dateRecurrences as $key => $label)
                                <option value="{{ $key }}" {{ ($automation->date_recurrence ?? '') == $key ? 'selected' : '' }}>{{ __($label) }}</option>
                            @endforeach
                        </x-forms.select>
                        <p class="f-11 text-lightest mt-1">Checked daily per company timezone. "Every Year" fires on the matching month/day (Feb 29 only in leap years); "One Time Only" fires only when that exact date is today.</p>
                    </div>
                </div>

                {{-- Wait before running: when set, matched automations queue a
                     pending run and actions execute later from the scheduler --}}
                <div class="row">
                    <div class="col-md-3">
                        <x-forms.number fieldId="wait_duration_value" :fieldLabel="__('Wait Before Running (optional)')" fieldName="wait_duration_value"
                            :fieldValue="$automation->wait_duration_value ?? ''" fieldHelp="Leave empty to run immediately" />
                    </div>
                    <div class="col-md-3" id="wait-unit-col">
                        <x-forms.select fieldId="wait_duration_unit" :fieldLabel="__('Wait Unit')" fieldName="wait_duration_unit">
                            @foreach($waitDurationUnits as $key => $label)
                                <option value="{{ $key }}" {{ ($automation->wait_duration_unit ?? 'days') == $key ? 'selected' : '' }}>{{ __($label) }}</option>
                            @endforeach
                        </x-forms.select>
                    </div>
                </div>
                <p class="f-11 text-lightest mt-1">Conditions are checked again when the wait ends — if they no longer hold, nothing runs. While waiting, only one delayed run is kept per deal/lead.</p>

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
                // action-row's remove button lives in its header .row, not the
                // whole card, so target the row/action-card wrapper explicitly.
                $(this).closest('.condition-row, .action-row').remove();
            });

            // Trigger Help Text Logic
            const triggerHelp = {
                '': 'Evaluates whenever the deal/lead is created or updated.',
                'deal_created': 'Evaluates only when a new deal is created.',
                'deal_updated': 'Evaluates when a deal\'s properties are updated.',
                'followup_created': 'Evaluates when a follow-up is added to the deal.',
                'custom_field_updated': 'Evaluates when a custom field value changes.',
                'lead_created': 'Evaluates only when a new lead is created.',
                'lead_updated': 'Evaluates when a lead\'s properties are updated.',
                'lead_followup_created': 'Evaluates when a follow-up/meeting is added to the lead (not to a deal).',
                'date_based': 'Runs once per matching day from the daily scheduler — pick the date field and whether it repeats every year or fires one time only.'
            };

            // Date-based trigger extras: shown only for trigger = 'date_based',
            // with the selects disabled while hidden so they never submit.
            function toggleDateTriggerConfig() {
                const active = $('#trigger').val() === 'date_based';
                $('#date-trigger-config').toggle(active);
                $('#date-trigger-config').find('select').prop('disabled', !active);
                if (active) {
                    $('#trigger_date_recurrence').selectpicker && $('#trigger_date_recurrence').selectpicker('refresh');
                    $('#trigger_date_field').selectpicker && $('#trigger_date_field').selectpicker('refresh');
                }
            }

            $('#trigger').change(function() {
                const val = $(this).val();
                $('#trigger-help-text').text(triggerHelp[val] || '');

                if (val === 'deal_updated' || val === 'lead_updated') {
                    $('#trigger-warning').slideDown();
                } else {
                    $('#trigger-warning').slideUp();
                }

                toggleDateTriggerConfig();
            });

            // Wait unit is only meaningful when a wait value is set
            function toggleWaitUnit() {
                $('#wait-unit-col').toggle(!!$('#wait_duration_value').val());
            }

            $('#wait_duration_value').on('input change', toggleWaitUnit);

            // Subject Type (Deal/Lead) Logic — filters which triggers/actions/
            // condition-field groups apply, since lead automations skip pipeline
            // scope and deal-only actions (stage_transition/lock_deal).
            function filterSelectBySubject(select, subjectType) {
                let changed = false;

                select.find('option[data-subject]').each(function() {
                    const option = $(this);
                    const optionSubject = option.data('subject');
                    const matches = optionSubject === 'any' || optionSubject === subjectType;
                    option.prop('hidden', !matches).prop('disabled', !matches);
                });

                if (select.find('option:selected').prop('disabled')) {
                    select.val(select.find('option:not(:disabled):first').val());
                    changed = true;
                }

                return changed;
            }

            function applySubjectTypeToConditionRow(row, subjectType) {
                const select = row.find('.condition-field-select');
                select.find('optgroup.subject-group-deal').toggle(subjectType !== 'lead');

                if (subjectType === 'lead' && select.find('option:selected').closest('optgroup.subject-group-deal').length) {
                    select.val('');
                    updateOperators(row);
                }
            }

            function applySubjectTypeToActionRow(row, subjectType) {
                const typeChanged = filterSelectBySubject(row.find('.action-type-select'), subjectType);
                if (typeChanged) {
                    toggleActionFields(row);
                }

                const fieldNameSelect = row.find('.action-field-name-select');
                fieldNameSelect.find('optgroup.action-field-group-deal').toggle(subjectType !== 'lead');
                fieldNameSelect.find('optgroup.action-field-group-lead').toggle(subjectType === 'lead');

                const selectedFieldOption = fieldNameSelect.find('option:selected');
                const inWrongGroup = subjectType === 'lead'
                    ? selectedFieldOption.closest('optgroup.action-field-group-deal').length
                    : selectedFieldOption.closest('optgroup.action-field-group-lead').length;

                if (inWrongGroup) {
                    fieldNameSelect.val('');
                    updateActionFieldValue(row);
                }

                // Send Email "Send To" checkboxes: hide/uncheck ones that don't
                // apply to this subject type (e.g. Deal Agent for a lead automation).
                row.find('.action-recipient-type-wrap').each(function() {
                    const wrap = $(this);
                    const matches = wrap.data('subject') === 'any' || wrap.data('subject') === subjectType;
                    wrap.toggle(matches);
                    if (!matches) {
                        wrap.find('.action-recipient-type-check').prop('checked', false);
                    }
                });
                toggleRecipientSubFields(row);
            }

            // Send Email recipients: reveal the "Specific User(s)" select and/or
            // "Custom Email Address(es)" textarea only when their checkbox is on.
            function toggleRecipientSubFields(row) {
                row.find('.action-recipient-user-container').toggle(
                    row.find('.action-recipient-type-check[value="specific_user"]').is(':checked')
                );
                row.find('.action-recipient-email-container').toggle(
                    row.find('.action-recipient-type-check[value="custom_email"]').is(':checked')
                );
            }

            $('body').on('change', '.action-recipient-type-check', function() {
                toggleRecipientSubFields($(this).closest('.action-row'));
            });

            $('.action-row').each(function() {
                toggleRecipientSubFields($(this));
            });

            function applySubjectType(subjectType) {
                $('#pipeline-scope-col').toggle(subjectType !== 'lead');

                if (filterSelectBySubject($('#trigger'), subjectType)) {
                    $('#trigger').trigger('change');
                }
                $('#trigger').selectpicker && $('#trigger').selectpicker('refresh');

                // Hide date-field options that don't apply to this subject type
                filterSelectBySubject($('#trigger_date_field'), subjectType);
                $('#trigger_date_field').selectpicker && $('#trigger_date_field').selectpicker('refresh');

                $('#conditions-container .condition-row').each(function() {
                    applySubjectTypeToConditionRow($(this), subjectType);
                });
                $('#actions-container .action-row').each(function() {
                    applySubjectTypeToActionRow($(this), subjectType);
                });
            }

            $('#subject_type').on('change', function() {
                applySubjectType($(this).val());
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
                    const newRow = $('#conditions-container .condition-row:last');
                    applySubjectTypeToConditionRow(newRow, $('#subject_type').val());
                    updateOperators(newRow);
                }, 0);
            });

            // Action Builder Logic
            // create_task and create_note share field names (title, content,
            // assigner_type/assigner_user_id) since only one block is ever
            // active per row — disabled inputs are excluded from form
            // serialization, so the hidden block's duplicate names never submit.
            function toggleActionFields(row) {
                const actionType = row.find('.action-type-select').val();
                const allBlocks = row.find('[class^="action-fields-"], [class*=" action-fields-"]');
                allBlocks.hide().find('input, select, textarea').prop('disabled', true);

                const activeBlock = row.find('.action-fields-' + (actionType || '').replace(/_/g, '-'));
                activeBlock.show().find('input, select, textarea').prop('disabled', false);
            }

            $('body').on('change', '.action-type-select', function() {
                toggleActionFields($(this).closest('.action-row'));
            });

            // Assign To / Created-Assigned By: reveal the user picker only when
            // "Specific User" is chosen (vs. dynamically resolved "Lead Owner").
            function toggleAssignmentUserSelect(typeSelect) {
                typeSelect.closest('.row').find('select[class*="-user-select"]').toggle(typeSelect.val() === 'specific_user');
            }

            $('body').on('change', '.action-assignee-type-select, .action-assigner-type-select', function() {
                toggleAssignmentUserSelect($(this));
            });

            $('.action-assignee-type-select, .action-assigner-type-select').each(function() {
                toggleAssignmentUserSelect($(this));
            });

            // Field Value dynamic input based on selected field_name
            function updateActionFieldValue(row) {
                const fieldName = row.find('.action-field-name-select').val();
                const container = row.find('.action-field-value-container');
                const existingInput = container.find('.action-field-value-input');
                const currentValue = existingInput.val() || '';

                // Get the base name for the input
                const nameAttr = existingInput.attr('name') || '';
                // Extract index from name like "actions[0][field_value]"
                const match = nameAttr.match(/actions\[(\w+)\]/);
                const idx = match ? match[1] : '0';
                const inputName = `actions[${idx}][field_value]`;

                if (fieldName === 'outcome_status') {
                    container.html(`
                        <label class="f-14 text-dark-grey mb-12">Value</label>
                        <select name="${inputName}" class="form-control height-35 f-14 action-field-value-input">
                            <option value="won" ${currentValue === 'won' ? 'selected' : ''}>Won</option>
                            <option value="lost" ${currentValue === 'lost' ? 'selected' : ''}>Lost</option>
                        </select>
                    `);
                } else if (['strategy_meeting_booked', 'downpayment_paid', 'deposit_confirmation', 'reservation_agreement', 'sales_contract'].includes(fieldName)) {
                    container.html(`
                        <label class="f-14 text-dark-grey mb-12">Value</label>
                        <select name="${inputName}" class="form-control height-35 f-14 action-field-value-input">
                            <option value="1" ${currentValue == '1' ? 'selected' : ''}>True / Yes</option>
                            <option value="0" ${currentValue == '0' ? 'selected' : ''}>False / No</option>
                        </select>
                    `);
                } else if (fieldName === 'temperature') {
                    container.html(`
                        <label class="f-14 text-dark-grey mb-12">Value</label>
                        <select name="${inputName}" class="form-control height-35 f-14 action-field-value-input">
                            <option value="cold" ${currentValue === 'cold' ? 'selected' : ''}>Cold</option>
                            <option value="warm" ${currentValue === 'warm' ? 'selected' : ''}>Warm</option>
                            <option value="hot" ${currentValue === 'hot' ? 'selected' : ''}>Hot</option>
                        </select>
                    `);
                } else {
                    container.html(`
                        <label class="f-14 text-dark-grey mb-12">Value</label>
                        <input type="text" name="${inputName}" class="form-control height-35 f-14 action-field-value-input" value="${currentValue}" placeholder="Value">
                    `);
                }
            }

            $('body').on('change', '.action-field-name-select', function() {
                updateActionFieldValue($(this).closest('.action-row'));
            });

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

            // Insert Tag: click a field in the "insert tag" dropdown to drop
            // @{{tag}} into the field it belongs to, at the cursor position —
            // so you don't have to know/remember the exact tag syntax up front.
            // Works on dynamically-added rows too since it's delegated to body,
            // and Bootstrap's own dropdown toggle is already delegated the
            // same way, so no re-init is needed when a new row is cloned in.
            $('body').on('click', '.tag-picker-item', function(e) {
                e.preventDefault();
                const tag = $(this).data('tag');
                const targetId = $(this).closest('.tag-picker-menu').data('target');
                const el = document.getElementById(targetId);
                if (!el) {
                    return;
                }
                insertTagAtCursor(el, '@{{' + tag + '}}');
            });

            function insertTagAtCursor(el, text) {
                const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
                const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length;
                el.value = el.value.slice(0, start) + text + el.value.slice(end);
                el.focus();
                const newPos = start + text.length;
                el.setSelectionRange(newPos, newPos);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Meta Conversion "Existing Event" picker: fills this row's own
            // Event Name input (scoped via closest(), not an id, since every
            // meta_conversion row repeats the same picker).
            $('body').on('change', '.meta-event-name-picker', function() {
                const val = $(this).val();
                if (val) {
                    $(this).closest('.action-fields-meta-conversion').find('input[name*="[meta_event_name]"]').val(val);
                }
            });

            // Initialize stages for existing rows
            $('.action-row').each(function() {
                updateStageOptions($(this));
                toggleActionFields($(this));
            });

            // Also initialize when adding a new row
            $('#add-action').click(function() {
                setTimeout(function() {
                    const newRow = $('#actions-container .action-row:last');
                    updateStageOptions(newRow);
                    toggleActionFields(newRow);
                    applySubjectTypeToActionRow(newRow, $('#subject_type').val());
                    newRow.find('.action-assignee-type-select, .action-assigner-type-select').each(function() {
                        toggleAssignmentUserSelect($(this));
                    });
                    // Fix forward_only checkbox id uniqueness
                    const idx = newRow.find('.action-type-select').attr('name').match(/actions\[(\w+)\]/)[1];
                    newRow.find('.forward-only-check').attr('id', 'forward_only_' + idx);
                    newRow.find('.forward-only-check').next('label').attr('for', 'forward_only_' + idx);
                }, 0);
            });

            // Initial render: filter triggers/conditions/actions to match the
            // currently selected subject type (deal on create; whatever the
            // automation was saved as on edit).
            applySubjectType($('#subject_type').val());

            // Show/hide the date-trigger config for a saved date_based
            // automation (applySubjectType only fires 'change' when it had to
            // reset the trigger select, so run this explicitly too).
            toggleDateTriggerConfig();

            toggleWaitUnit();

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
