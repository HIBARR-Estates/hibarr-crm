<div class="visibility-rules-tab">
    <div class="alert alert-info mb-3">
        <i class="fa fa-info-circle"></i> 
        Configure when this field should be visible based on values in other fields.
    </div>

    <form id="visibilityRulesForm">
        <input type="hidden" name="field_id" value="{{ $field->id }}" />
        
        <div class="form-group">
            <label class="control-label">
                <input type="checkbox" id="enableRules" name="enabled" value="1" 
                       {{ ($field->showRuleSet && $field->showRuleSet->enabled) ? 'checked' : '' }} />
                Enable visibility rules
            </label>
            <small class="form-text text-muted">
                When enabled, this field will only be visible when the conditions below are met.
            </small>
        </div>

        <div class="form-group">
            <label class="control-label">Default Visibility</label>
            <div class="radio-group">
                <label class="radio-inline">
                    <input type="radio" name="default_visibility" value="1" 
                           {{ (!$field->showRuleSet || $field->showRuleSet->default_visibility) ? 'checked' : '' }} />
                    Show (default)
                </label>
                <label class="radio-inline">
                    <input type="radio" name="default_visibility" value="0" 
                           {{ ($field->showRuleSet && !$field->showRuleSet->default_visibility) ? 'checked' : '' }} />
                    Hide (default)
                </label>
            </div>
            <small class="form-text text-muted">
                What should happen when rules are disabled or no rules match?
            </small>
        </div>

        <div id="rulesContainer" style="{{ (!$field->showRuleSet || !$field->showRuleSet->enabled) ? 'display: none;' : '' }}">
            <div class="card mb-3">
                <div class="card-header">
                    <h5 class="mb-0">Rule Group</h5>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label class="control-label">Group Operator</label>
                        <select name="group_operator" id="groupOperator" class="form-control">
                            <option value="AND" {{ (!$field->showRuleSet || !$field->showRuleSet->group || $field->showRuleSet->group->group_operator == 'AND') ? 'selected' : '' }}>
                                AND (all criteria must match)
                            </option>
                            <option value="OR" {{ ($field->showRuleSet && $field->showRuleSet->group && $field->showRuleSet->group->group_operator == 'OR') ? 'selected' : '' }}>
                                OR (any criterion must match)
                            </option>
                        </select>
                    </div>

                    <div id="criteriaContainer">
                        @if($field->showRuleSet && $field->showRuleSet->group && $field->showRuleSet->group->criteria)
                            @foreach($field->showRuleSet->group->criteria as $index => $criterion)
                                <div class="criterion-item card mb-2" data-index="{{ $index }}">
                                    <div class="card-body">
                                        <div class="row">
                                            <div class="col-md-4">
                                                <div class="form-group">
                                                    <label>Reference Field</label>
                                                    <select name="criteria[{{ $index }}][reference_field_id]" class="form-control reference-field-select">
                                                        <option value="">Select field...</option>
                                                        @foreach($availableFields as $availableField)
                                                            <option value="{{ $availableField->id }}" 
                                                                    {{ $criterion->reference_field_id == $availableField->id ? 'selected' : '' }}>
                                                                {{ $availableField->label }} ({{ $availableField->type }})
                                                            </option>
                                                        @endforeach
                                                    </select>
                                                </div>
                                            </div>
                                            <div class="col-md-3">
                                                <div class="form-group">
                                                    <label>Operator</label>
                                                    <select name="criteria[{{ $index }}][operator]" class="form-control operator-select">
                                                        <option value="equals" {{ $criterion->operator == 'equals' ? 'selected' : '' }}>equals</option>
                                                        <option value="exists" {{ $criterion->operator == 'exists' ? 'selected' : '' }}>exists</option>
                                                        <option value="boolean" {{ $criterion->operator == 'boolean' ? 'selected' : '' }}>is boolean</option>
                                                        <option value=">" {{ $criterion->operator == '>' ? 'selected' : '' }}>greater than</option>
                                                        <option value="<" {{ $criterion->operator == '<' ? 'selected' : '' }}>less than</option>
                                                        <option value=">=" {{ $criterion->operator == '>=' ? 'selected' : '' }}>greater than or equal</option>
                                                        <option value="<=" {{ $criterion->operator == '<=' ? 'selected' : '' }}>less than or equal</option>
                                                        <option value="in" {{ $criterion->operator == 'in' ? 'selected' : '' }}>in list</option>
                                                        <option value="not_in" {{ $criterion->operator == 'not_in' ? 'selected' : '' }}>not in list</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div class="col-md-4">
                                                <div class="form-group value-input-group">
                                                    <label>Value</label>
                                                    <input type="text" name="criteria[{{ $index }}][reference_value]" 
                                                           class="form-control reference-value-input" 
                                                           value="{{ $criterion->reference_value }}"
                                                           placeholder="Enter value" />
                                                </div>
                                            </div>
                                            <div class="col-md-1">
                                                <div class="form-group">
                                                    <label>&nbsp;</label>
                                                    <button type="button" class="btn btn-danger btn-sm remove-criterion" style="display: block;">
                                                        <i class="fa fa-trash"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="row">
                                            <div class="col-md-12">
                                                <label>
                                                    <input type="checkbox" name="criteria[{{ $index }}][negate]" value="1" 
                                                           {{ $criterion->negate ? 'checked' : '' }} />
                                                    Negate (NOT) - Reverse the condition
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        @endif
                    </div>

                    <button type="button" id="addCriterion" class="btn btn-secondary btn-sm">
                        <i class="fa fa-plus"></i> Add Criterion
                    </button>
                </div>
            </div>
        </div>

        <div class="form-group mt-3">
            <button type="button" id="saveVisibilityRules" class="btn btn-primary">
                <i class="fa fa-save"></i> Save Rules
            </button>
            <button type="button" class="btn btn-secondary" onclick="$('#basic-tab').tab('show');">
                Cancel
            </button>
        </div>
    </form>
</div>

<script>
$(document).ready(function() {
    let criterionIndex = {{ ($field->showRuleSet && $field->showRuleSet->group && $field->showRuleSet->group->criteria) ? count($field->showRuleSet->group->criteria) : 0 }};

    // Toggle rules container
    $('#enableRules').on('change', function() {
        if ($(this).is(':checked')) {
            $('#rulesContainer').slideDown();
        } else {
            $('#rulesContainer').slideUp();
        }
    });

    // Add new criterion
    $('#addCriterion').on('click', function() {
        const criterionHtml = `
            <div class="criterion-item card mb-2" data-index="${criterionIndex}">
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="form-group">
                                <label>Reference Field</label>
                                <select name="criteria[${criterionIndex}][reference_field_id]" class="form-control reference-field-select">
                                    <option value="">Select field...</option>
                                    @foreach($availableFields as $availableField)
                                        <option value="{{ $availableField->id }}">{{ $availableField->label }} ({{ $availableField->type }})</option>
                                    @endforeach
                                </select>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group">
                                <label>Operator</label>
                                <select name="criteria[${criterionIndex}][operator]" class="form-control operator-select">
                                    <option value="equals">equals</option>
                                    <option value="exists">exists</option>
                                    <option value="boolean">is boolean</option>
                                    <option value=">">greater than</option>
                                    <option value="<">less than</option>
                                    <option value=">=">greater than or equal</option>
                                    <option value="<=">less than or equal</option>
                                    <option value="in">in list</option>
                                    <option value="not_in">not in list</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group value-input-group">
                                <label>Value</label>
                                <input type="text" name="criteria[${criterionIndex}][reference_value]" 
                                       class="form-control reference-value-input" 
                                       placeholder="Enter value" />
                            </div>
                        </div>
                        <div class="col-md-1">
                            <div class="form-group">
                                <label>&nbsp;</label>
                                <button type="button" class="btn btn-danger btn-sm remove-criterion" style="display: block;">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-12">
                            <label>
                                <input type="checkbox" name="criteria[${criterionIndex}][negate]" value="1" />
                                Negate (NOT) - Reverse the condition
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('#criteriaContainer').append(criterionHtml);
        criterionIndex++;
    });

    // Remove criterion
    $(document).on('click', '.remove-criterion', function() {
        $(this).closest('.criterion-item').fadeOut(300, function() {
            $(this).remove();
        });
    });

    // Handle operator change - show/hide value input for exists/boolean
    $(document).on('change', '.operator-select', function() {
        const operator = $(this).val();
        const valueGroup = $(this).closest('.criterion-item').find('.value-input-group');
        
        if (operator === 'exists' || operator === 'boolean') {
            valueGroup.hide();
            valueGroup.find('.reference-value-input').removeAttr('required');
        } else if (operator === 'in' || operator === 'not_in') {
            valueGroup.show();
            valueGroup.find('label').text('Value (JSON Array, e.g., ["Yes", "No"])');
            valueGroup.find('.reference-value-input').attr('placeholder', '["Yes", "No"]');
        } else {
            valueGroup.show();
            valueGroup.find('label').text('Value');
            valueGroup.find('.reference-value-input').attr('placeholder', 'Enter value');
        }
    });

    // Save visibility rules
    $('#saveVisibilityRules').on('click', function() {
        // Convert form values to proper types
        const defaultVisibility = $('input[name="default_visibility"]:checked').val() == '1';
        const enabled = $('#enableRules').is(':checked');
        
        const formData = {
            rule_set: {
                default_visibility: defaultVisibility,
                enabled: enabled,
                group: {
                    group_operator: $('#groupOperator').val() || 'AND',
                    criteria: []
                }
            }
        };

        // Collect criteria
        $('.criterion-item').each(function() {
            const referenceFieldId = $(this).find('.reference-field-select').val();
            const operator = $(this).find('.operator-select').val();
            const referenceValue = $(this).find('.reference-value-input').val();
            const negate = $(this).find('input[name*="[negate]"]').is(':checked');

            if (referenceFieldId && operator) {
                // Only require value for operators that need it
                if (operator !== 'exists' && operator !== 'boolean') {
                    if (!referenceValue) {
                        alert('Please fill in all criterion values');
                        return false;
                    }
                }

                formData.rule_set.group.criteria.push({
                    reference_field_id: parseInt(referenceFieldId),
                    operator: operator,
                    reference_value: (operator === 'exists' || operator === 'boolean') ? null : (referenceValue || null),
                    negate: Boolean(negate) // Ensure it's a boolean
                });
            }
        });

        // Validate
        if ($('#enableRules').is(':checked') && formData.rule_set.group.criteria.length === 0) {
            alert('Please add at least one criterion when rules are enabled');
            return;
        }

        const saveUrl = "{{ route('custom-fields.save-rule-set', $field->id) }}";
        const token = "{{ csrf_token() }}";

        // Add CSRF token to form data
        formData._token = token;

        // Disable button to prevent double submission
        const $saveButton = $('#saveVisibilityRules');
        $saveButton.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving...');

        $.easyAjax({
            url: saveUrl,
            type: 'POST',
            data: formData,
            blockUI: false, // Changed to false to prevent loading loop
            buttonSelector: null, // Remove button selector to prevent auto-blocking
            success: function(response) {
                // Re-enable button
                $saveButton.prop('disabled', false).html('<i class="fa fa-save"></i> Save Rules');
                
                if (response.status == 'success' || response.success) {
                    $.showToastr(response.message || 'Visibility rules saved successfully', 'success');
                    // Close the modal after a short delay to show the toast
                    setTimeout(function() {
                        // Unblock UI if it's still blocked
                        if (typeof $.unblockUI === 'function') {
                            $.unblockUI();
                        }
                        // Close modal
                        if (typeof MODAL_LG !== 'undefined' && $(MODAL_LG).length) {
                            $(MODAL_LG).modal('hide');
                        } else if ($('.modal').length) {
                            $('.modal').modal('hide');
                        }
                    }, 500);
                } else {
                    $.showToastr(response.message || 'Failed to save visibility rules', 'error');
                }
            },
            error: function(response) {
                // Re-enable button on error
                $saveButton.prop('disabled', false).html('<i class="fa fa-save"></i> Save Rules');
                
                // Unblock UI if it's still blocked
                if (typeof $.unblockUI === 'function') {
                    $.unblockUI();
                }
                
                if (response.responseJSON && response.responseJSON.errors) {
                    let errorMsg = 'Validation errors:\n';
                    $.each(response.responseJSON.errors, function(key, errors) {
                        errorMsg += errors.join('\n') + '\n';
                    });
                    alert(errorMsg);
                } else if (response.responseJSON && response.responseJSON.message) {
                    $.showToastr(response.responseJSON.message, 'error');
                } else {
                    $.showToastr('Failed to save visibility rules', 'error');
                }
            }
        });
    });
});
</script>

<style>
.visibility-rules-tab {
    padding: 20px;
}
.criterion-item {
    border: 1px solid #e0e0e0;
}
.radio-group label {
    margin-right: 20px;
}
</style>

