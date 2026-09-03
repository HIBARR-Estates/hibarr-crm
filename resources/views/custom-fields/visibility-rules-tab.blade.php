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
            <div id="groupsOperatorContainer" class="form-group mb-3" style="display: none;">
                <label class="control-label">Show Groups Operator</label>
                <select name="groups_operator" id="groupsOperator" class="form-control select-picker" data-size="8">
                    <option value="AND" {{ (!$field->showRuleSet || !$field->showRuleSet->groups_operator || $field->showRuleSet->groups_operator == 'AND') ? 'selected' : '' }}>
                        AND (all show groups must match)
                    </option>
                    <option value="OR" {{ ($field->showRuleSet && $field->showRuleSet->groups_operator == 'OR') ? 'selected' : '' }}>
                        OR (any show group must match)
                    </option>
                </select>
                <small class="form-text text-muted">
                    <strong>Note:</strong> Hide groups always take precedence. If any hide group matches, the field will be hidden regardless of show groups or this operator. This operator only applies to show groups.
                </small>
                <small class="form-text text-muted">
                    How to combine multiple rule groups.
                </small>
            </div>
            
            <div id="groupsContainer">
                @php
                    $groupsToShow = [];
                    if ($field->showRuleSet) {
                        // Make sure groups are loaded
                        if (!$field->showRuleSet->relationLoaded('groups')) {
                            $field->showRuleSet->load(['groups' => function($q) {
                                $q->orderBy('id')->with('criteria.referenceField');
                            }]);
                        }
                        
                        // Check if groups exist and have items
                        $groups = $field->showRuleSet->groups;
                        if ($groups && $groups->count() > 0) {
                            // Ensure criteria are loaded for each group BEFORE converting to array
                            foreach ($groups as $group) {
                                if (!$group->relationLoaded('criteria')) {
                                    $group->load('criteria.referenceField');
                                }
                                // Ensure criteria collection is properly indexed and accessible
                                if ($group->criteria) {
                                    $group->setRelation('criteria', $group->criteria->sortBy('id')->values());
                                } else {
                                    // Initialize empty collection if criteria don't exist
                                    $group->setRelation('criteria', collect());
                                }
                            }
                            // Keep as collection to preserve relationships (don't convert to array)
                            // This ensures eager-loaded relationships remain accessible
                            $groupsToShow = $groups->sortBy('id')->values();
                        } elseif ($field->showRuleSet->group) {
                            // Load criteria for single group if not loaded
                            if (!$field->showRuleSet->group->relationLoaded('criteria')) {
                                $field->showRuleSet->group->load('criteria.referenceField');
                            }
                            // Convert single group to array for consistency
                            $groupsToShow = [$field->showRuleSet->group];
                        } else {
                            // No groups, create one empty group
                            $groupsToShow = [null];
                        }
                    } else {
                        // No rule set, create one empty group
                        $groupsToShow = [null];
                    }
                @endphp
                
                @foreach($groupsToShow as $groupIndex => $group)
                    <div class="group-item card mb-3" data-group-index="{{ $groupIndex }}">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">Rule Group {{ $groupIndex + 1 }}</h5>
                            @if(count($groupsToShow) > 1)
                                <button type="button" class="btn btn-danger btn-sm remove-group">
                                    <i class="fa fa-trash"></i> Remove Group
                                </button>
                            @endif
                        </div>
                        <div class="card-body">
                            <div class="form-group mb-3">
                                <label class="control-label">
                                    <input type="checkbox" name="groups[{{ $groupIndex }}][enabled]" value="1" 
                                           {{ (!$group || $group->enabled !== false) ? 'checked' : '' }} />
                                    Enable this group
                                </label>
                                <small class="form-text text-muted">
                                    When disabled, this group will be ignored when evaluating visibility rules.
                                </small>
                            </div>
                            
                            <div class="form-group mb-3">
                                <label class="control-label">Visibility Action</label>
                                <select name="groups[{{ $groupIndex }}][visibility_action]" class="form-control select-picker visibility-action-select" data-size="8">
                                    <option value="show" {{ (!$group || $group->visibility_action == 'show' || !$group->visibility_action) ? 'selected' : '' }}>
                                        Show field when this group matches
                                    </option>
                                    <option value="hide" {{ ($group && $group->visibility_action == 'hide') ? 'selected' : '' }}>
                                        Hide field when this group matches
                                    </option>
                                </select>
                                <small class="form-text text-muted">
                                    Choose whether this group should show or hide the field when its conditions are met. Hide groups take precedence over show groups.
                                </small>
                            </div>
                            
                            <div class="form-group">
                                <label class="control-label">Group Operator</label>
                                <select name="groups[{{ $groupIndex }}][group_operator]" class="form-control select-picker group-operator-select" data-size="8">
                                    <option value="AND" {{ (!$group || $group->group_operator == 'AND') ? 'selected' : '' }}>
                                        AND (all criteria must match)
                                    </option>
                                    <option value="OR" {{ ($group && $group->group_operator == 'OR') ? 'selected' : '' }}>
                                        OR (any criterion must match)
                                    </option>
                                </select>
                            </div>

                            <div class="criteria-container" data-group-index="{{ $groupIndex }}">
                                @php
                                    // Access criteria from already-eager-loaded relationship
                                    // Criteria should be loaded via eager loading in controller (criteria.referenceField)
                                    $groupCriteria = collect();
                                    if ($group && isset($group->criteria)) {
                                        // Access the already-loaded criteria relationship
                                        if (is_object($group->criteria) && method_exists($group->criteria, 'sortBy')) {
                                            $groupCriteria = $group->criteria->sortBy('id')->values();
                                        } elseif (is_array($group->criteria)) {
                                            $groupCriteria = collect($group->criteria)->sortBy('id')->values();
                                        } else {
                                            $groupCriteria = collect($group->criteria);
                                        }
                                    }
                                @endphp
                                @if($group && $groupCriteria && $groupCriteria->count() > 0)
                                    @foreach($groupCriteria as $criterionIndex => $criterion)
                                        @php
                                            $criterionSource = $criterion->reference_source ?? 'custom_field';
                                        @endphp
                                        <div class="criterion-item card mb-2" data-criterion-index="{{ $criterionIndex }}" data-reference-source="{{ $criterionSource }}">
                                            <div class="card-body">
                                                @if($criterionSource !== 'custom_field')
                                                    {{-- This legacy tab only has UI to edit custom_field criteria. A
                                                         pipeline/pipeline_stage criterion (built in the newer React
                                                         rule builder) is shown read-only here so saving this tab
                                                         round-trips it unchanged instead of dropping or corrupting
                                                         it into a broken custom_field criterion. --}}
                                                    <div class="alert alert-secondary mb-2 py-1 px-2" style="font-size: 12px;">
                                                        This criterion reads the deal's <strong>{{ $criterionSource === 'pipeline' ? 'pipeline' : 'pipeline stage' }}</strong> — edit it from the field's visibility rule builder, not here.
                                                    </div>
                                                @endif
                                                <div class="row">
                                                    <div class="col-md-4">
                                                        <div class="form-group">
                                                            <label>Reference Field</label>
                                                            <select name="groups[{{ $groupIndex }}][criteria][{{ $criterionIndex }}][reference_field_id]" class="form-control select-picker reference-field-select" data-live-search="true" data-size="8" @if($criterionSource !== 'custom_field') disabled @endif>
                                                                <option value="">Select field...</option>
                                                                @foreach($otherFields as $availableField)
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
                                                            <select name="groups[{{ $groupIndex }}][criteria][{{ $criterionIndex }}][operator]" class="form-control select-picker operator-select" data-size="8">
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
                                                            <input type="text"
                                                                   name="groups[{{ $groupIndex }}][criteria][{{ $criterionIndex }}][reference_value]"
                                                                   id="groups[{{ $groupIndex }}][criteria][{{ $criterionIndex }}][reference_value]"
                                                                   class="form-control height-35 f-14 reference-value-input"
                                                                   value="{{ $criterion->reference_value ?? '' }}"
                                                                   placeholder="Enter value"
                                                                   @if($criterionSource !== 'custom_field') disabled @endif />
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
                                                            <input type="checkbox" name="groups[{{ $groupIndex }}][criteria][{{ $criterionIndex }}][negate]" value="1" 
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

                            <button type="button" class="btn btn-secondary btn-sm add-criterion" data-group-index="{{ $groupIndex }}">
                                <i class="fa fa-plus"></i> Add Criterion
                            </button>
                        </div>
                    </div>
                @endforeach
            </div>
            
            <button type="button" id="addGroup" class="btn btn-primary btn-sm mb-3">
                <i class="fa fa-plus"></i> Add Group
            </button>
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
    // Initialize Bootstrap Select for all existing selects
    $('.select-picker').each(function() {
        const $select = $(this);
        const liveSearch = $select.data('live-search') || $select.attr('data-live-search') === 'true';
        $select.selectpicker({
            liveSearch: liveSearch,
            liveSearchNormalize: true, // Normalize search (remove accents, etc.)
            size: $select.data('size') || 8
        });
    });
    
    let groupIndex = {{ count($groupsToShow) }};
    let criterionIndices = {};
    
    // Initialize criterion indices for existing groups
    @foreach($groupsToShow as $gIndex => $group)
        @if($group && $group->criteria)
            criterionIndices[{{ $gIndex }}] = {{ count($group->criteria) }};
        @else
            criterionIndices[{{ $gIndex }}] = 0;
        @endif
    @endforeach

    // Update groups operator visibility
    function updateGroupsOperatorVisibility() {
        const groupCount = $('.group-item').length;
        if (groupCount > 1) {
            $('#groupsOperatorContainer').show();
        } else {
            $('#groupsOperatorContainer').hide();
        }
    }

    // Toggle rules container
    $('#enableRules').on('change', function() {
        if ($(this).is(':checked')) {
            $('#rulesContainer').slideDown();
        } else {
            $('#rulesContainer').slideUp();
        }
    });

    // Add new group
    $('#addGroup').on('click', function() {
        const newGroupHtml = `
            <div class="group-item card mb-3" data-group-index="${groupIndex}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Rule Group ${groupIndex + 1}</h5>
                    <button type="button" class="btn btn-danger btn-sm remove-group">
                        <i class="fa fa-trash"></i> Remove Group
                    </button>
                </div>
                    <div class="card-body">
                    <div class="form-group mb-3">
                        <label class="control-label">
                            <input type="checkbox" name="groups[${groupIndex}][enabled]" value="1" checked />
                            Enable this group
                        </label>
                        <small class="form-text text-muted">
                            When disabled, this group will be ignored when evaluating visibility rules.
                        </small>
                    </div>
                    
                    <div class="form-group mb-3">
                        <label class="control-label">Visibility Action</label>
                        <select name="groups[${groupIndex}][visibility_action]" class="form-control select-picker visibility-action-select" data-size="8">
                            <option value="show">Show field when this group matches</option>
                            <option value="hide">Hide field when this group matches</option>
                        </select>
                        <small class="form-text text-muted">
                            Choose whether this group should show or hide the field when its conditions are met. Hide groups take precedence over show groups.
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label class="control-label">Group Operator</label>
                        <select name="groups[${groupIndex}][group_operator]" class="form-control select-picker group-operator-select" data-size="8">
                            <option value="AND">AND (all criteria must match)</option>
                            <option value="OR">OR (any criterion must match)</option>
                        </select>
                    </div>
                    <div class="criteria-container" data-group-index="${groupIndex}"></div>
                    <button type="button" class="btn btn-secondary btn-sm add-criterion" data-group-index="${groupIndex}">
                        <i class="fa fa-plus"></i> Add Criterion
                    </button>
                </div>
            </div>
        `;
        $('#groupsContainer').append(newGroupHtml);
        criterionIndices[groupIndex] = 0;
        groupIndex++;
        updateGroupsOperatorVisibility();
        
        // Initialize Bootstrap Select for any selects in the new group
        $('#groupsContainer').find('.group-item').last().find('.select-picker').each(function() {
            const $select = $(this);
            const liveSearch = $select.data('live-search') || $select.attr('data-live-search') === 'true';
            $select.selectpicker({
                liveSearch: liveSearch,
                liveSearchNormalize: true,
                size: $select.data('size') || 8
            });
        });
    });

    // Remove group
    $(document).on('click', '.remove-group', function() {
        if ($('.group-item').length <= 1) {
            alert('You must have at least one group');
            return;
        }
        const $groupItem = $(this).closest('.group-item');
        // Destroy Bootstrap Select instances before removing
        $groupItem.find('.select-picker').each(function() {
            if ($(this).data('selectpicker')) {
                $(this).selectpicker('destroy');
            }
        });
        $groupItem.fadeOut(300, function() {
            $(this).remove();
            updateGroupsOperatorVisibility();
            // Renumber groups
            $('.group-item').each(function(index) {
                $(this).find('h5').text('Rule Group ' + (index + 1));
                $(this).attr('data-group-index', index);
                
                // Update group operator select
                const $groupOperatorSelect = $(this).find('.group-operator-select');
                $groupOperatorSelect.attr('name', `groups[${index}][group_operator]`);
                if ($groupOperatorSelect.data('selectpicker')) {
                    $groupOperatorSelect.selectpicker('refresh');
                }
                
                // Update visibility action select
                const $visibilityActionSelect = $(this).find('.visibility-action-select');
                $visibilityActionSelect.attr('name', `groups[${index}][visibility_action]`);
                if ($visibilityActionSelect.data('selectpicker')) {
                    $visibilityActionSelect.selectpicker('refresh');
                }
                
                $(this).find('.add-criterion').attr('data-group-index', index);
                $(this).find('.criteria-container').attr('data-group-index', index);
                
                // Update criterion names
                $(this).find('.criterion-item').each(function(critIdx) {
                    const $refFieldSelect = $(this).find('.reference-field-select');
                    const $operatorSelect = $(this).find('.operator-select');
                    
                    $refFieldSelect.attr('name', `groups[${index}][criteria][${critIdx}][reference_field_id]`);
                    $operatorSelect.attr('name', `groups[${index}][criteria][${critIdx}][operator]`);
                    $(this).find('.reference-value-input').attr('name', `groups[${index}][criteria][${critIdx}][reference_value]`);
                    $(this).find('input[name*="[negate]"]').attr('name', `groups[${index}][criteria][${critIdx}][negate]`);
                    
                    // Refresh Bootstrap Select instances
                    if ($refFieldSelect.data('selectpicker')) {
                        $refFieldSelect.selectpicker('refresh');
                    }
                    if ($operatorSelect.data('selectpicker')) {
                        $operatorSelect.selectpicker('refresh');
                    }
                });
            });
        });
    });

    // Add new criterion to a specific group
    $(document).on('click', '.add-criterion', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const $button = $(this);
        // Disable button temporarily to prevent double-clicks
        if ($button.prop('disabled')) {
            return false;
        }
        $button.prop('disabled', true);
        
        const groupIdx = $button.data('group-index');
        const criterionIdx = criterionIndices[groupIdx] || 0;
        const criterionHtml = `
            <div class="criterion-item card mb-2" data-criterion-index="${criterionIdx}">
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-4">
                            <div class="form-group">
                                <label>Reference Field</label>
                                <select name="groups[${groupIdx}][criteria][${criterionIdx}][reference_field_id]" class="form-control select-picker reference-field-select" data-live-search="true" data-size="8">
                                    <option value="">Select field...</option>
                                    @foreach($otherFields as $availableField)
                                        <option value="{{ $availableField->id }}">{{ $availableField->label }} ({{ $availableField->type }})</option>
                                    @endforeach
                                </select>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group">
                                <label>Operator</label>
                                <select name="groups[${groupIdx}][criteria][${criterionIdx}][operator]" class="form-control select-picker operator-select" data-size="8">
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
                                <input type="text" name="groups[${groupIdx}][criteria][${criterionIdx}][reference_value]" 
                                       class="form-control height-35 f-14 reference-value-input" 
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
                                <input type="checkbox" name="groups[${groupIdx}][criteria][${criterionIdx}][negate]" value="1" />
                                Negate (NOT) - Reverse the condition
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
        const $criteriaContainer = $button.siblings('.criteria-container');
        $criteriaContainer.append(criterionHtml);
        criterionIndices[groupIdx] = (criterionIndices[groupIdx] || 0) + 1;
        
        // Initialize Bootstrap Select for the newly added selects
        // Use a small delay to ensure DOM is fully ready
        setTimeout(function() {
            const $newCriterion = $criteriaContainer.find('.criterion-item').last();
            // Initialize all select-picker elements within the new criterion
            $newCriterion.find('.select-picker').each(function() {
                const $select = $(this);
                // Destroy if already initialized (safety check)
                if ($select.data('selectpicker')) {
                    $select.selectpicker('destroy');
                }
                // Initialize Bootstrap Select with options
                // Check if live-search is enabled via data attribute
                const liveSearch = $select.data('live-search') || $select.attr('data-live-search') === 'true';
                $select.selectpicker({
                    liveSearch: liveSearch,
                    liveSearchNormalize: true, // Normalize search (remove accents, etc.)
                    size: $select.data('size') || 8
                });
            });
            
            // Trigger operator change to show/hide value input
            $newCriterion.find('.operator-select').trigger('change');
        }, 50);
        
        // Re-enable button after a short delay
        setTimeout(function() {
            $button.prop('disabled', false);
        }, 300);
        
        return false;
    });

    // Remove criterion
    $(document).on('click', '.remove-criterion', function() {
        const $criterionItem = $(this).closest('.criterion-item');
        // Destroy Bootstrap Select instances before removing
        $criterionItem.find('.select-picker').each(function() {
            if ($(this).data('selectpicker')) {
                $(this).selectpicker('destroy');
            }
        });
        $criterionItem.fadeOut(300, function() {
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

    // Initialize operator visibility for existing criteria
    $('.operator-select').each(function() {
        $(this).trigger('change');
    });

    // Initialize groups operator visibility
    updateGroupsOperatorVisibility();

    // Save visibility rules
    $('#saveVisibilityRules').on('click', function() {
        // Refresh Bootstrap Select to ensure values are synced
        $('.select-picker').each(function() {
            if ($(this).data('selectpicker')) {
                $(this).selectpicker('refresh');
            }
        });
        
        // Convert form values to proper types
        const defaultVisibility = $('input[name="default_visibility"]:checked').val() == '1';
        const enabled = $('#enableRules').is(':checked');
        
        const formData = {
            rule_set: {
                default_visibility: defaultVisibility,
                enabled: enabled,
                groups_operator: (function() {
                    const $select = $('#groupsOperator');
                    if ($select.length > 0) {
                        if ($select.data('selectpicker')) {
                            const val = $select.selectpicker('val');
                            return Array.isArray(val) ? (val[0] || 'AND') : (val || 'AND');
                        } else {
                            return $select.val() || 'AND';
                        }
                    }
                    return 'AND';
                })(),
                groups: []
            }
        };

        // Collect all groups and their criteria
        let validationError = false;
        let hasCriteria = false;
        $('.group-item').each(function() {
            // Skip remaining groups if validation error occurred
            if (validationError) {
                return false; // Exit outer loop
            }
            // Get values from Bootstrap Select or regular select
            const $groupOperatorSelect = $(this).find('.group-operator-select');
            const $visibilityActionSelect = $(this).find('.visibility-action-select');
            
            let groupOperator = null;
            let visibilityAction = null;
            
            // Method 1: Try Bootstrap Select API first (most reliable for Bootstrap Select)
            if ($groupOperatorSelect.data('selectpicker')) {
                try {
                    const bsVal = $groupOperatorSelect.selectpicker('val');
                    if (bsVal !== null && bsVal !== undefined && bsVal !== '') {
                        groupOperator = Array.isArray(bsVal) ? String(bsVal[0]) : String(bsVal);
                    }
                } catch (e) {
                    // Continue to fallback
                }
            }
            
            // Method 2: Check the actual selected option in the DOM
            if (!groupOperator) {
                const selectedOption = $groupOperatorSelect.find('option:selected');
                if (selectedOption.length && selectedOption.val() !== '') {
                    groupOperator = String(selectedOption.val());
                }
            }
            
            // Method 3: Fallback to .val() on the select element
            if (!groupOperator) {
                const val = $groupOperatorSelect.val();
                if (val && val !== '') {
                    groupOperator = String(val);
                }
            }
            
            // Default to 'AND' if still not found
            if (!groupOperator || (groupOperator !== 'AND' && groupOperator !== 'OR')) {
                groupOperator = 'AND';
            }
            
            // Same approach for visibility action
            if ($visibilityActionSelect.data('selectpicker')) {
                try {
                    const bsVal = $visibilityActionSelect.selectpicker('val');
                    if (bsVal !== null && bsVal !== undefined && bsVal !== '') {
                        visibilityAction = Array.isArray(bsVal) ? String(bsVal[0]) : String(bsVal);
                    }
                } catch (e) {
                    // Continue to fallback
                }
            }
            
            if (!visibilityAction) {
                const selectedOption = $visibilityActionSelect.find('option:selected');
                if (selectedOption.length && selectedOption.val() !== '') {
                    visibilityAction = String(selectedOption.val());
                }
            }
            
            if (!visibilityAction) {
                const val = $visibilityActionSelect.val();
                if (val && val !== '') {
                    visibilityAction = String(val);
                }
            }
            
            // Default to 'show' if still not found
            if (!visibilityAction || (visibilityAction !== 'show' && visibilityAction !== 'hide')) {
                visibilityAction = 'show';
            }
            
            
            const groupEnabled = $(this).find('input[name*="[enabled]"]').is(':checked');
            const group = {
                group_operator: groupOperator,
                enabled: Boolean(groupEnabled),
                visibility_action: visibilityAction,
                criteria: []
            };

            // Collect criteria for this group
            $(this).find('.criterion-item').each(function() {
                // Skip remaining criteria if validation error occurred
                if (validationError) {
                    return false; // Exit inner loop
                }
                
                const $refFieldSelect = $(this).find('.reference-field-select');
                const $operatorSelect = $(this).find('.operator-select');
                
                let referenceFieldId = null;
                let operator = null;
                
                // Method 1: Try Bootstrap Select API first (most reliable for Bootstrap Select)
                if ($refFieldSelect.data('selectpicker')) {
                    try {
                        const bsVal = $refFieldSelect.selectpicker('val');
                        if (bsVal !== null && bsVal !== undefined && bsVal !== '') {
                            referenceFieldId = Array.isArray(bsVal) ? String(bsVal[0]) : String(bsVal);
                        }
                    } catch (e) {
                        // Continue to fallback
                    }
                }
                
                // Method 2: Check the actual selected option in the DOM
                if (!referenceFieldId) {
                    const selectedOption = $refFieldSelect.find('option:selected');
                    if (selectedOption.length && selectedOption.val() !== '') {
                        referenceFieldId = String(selectedOption.val());
                    }
                }
                
                // Method 3: Fallback to .val() on the select element
                if (!referenceFieldId) {
                    const val = $refFieldSelect.val();
                    if (val && val !== '') {
                        referenceFieldId = String(val);
                    }
                }
                
                // Same for operator
                if ($operatorSelect.data('selectpicker')) {
                    try {
                        const bsVal = $operatorSelect.selectpicker('val');
                        if (bsVal !== null && bsVal !== undefined && bsVal !== '') {
                            operator = Array.isArray(bsVal) ? String(bsVal[0]) : String(bsVal);
                        }
                    } catch (e) {
                        // Continue to fallback
                    }
                }
                
                if (!operator) {
                    const selectedOption = $operatorSelect.find('option:selected');
                    if (selectedOption.length && selectedOption.val() !== '') {
                        operator = String(selectedOption.val());
                    }
                }
                
                if (!operator) {
                    const val = $operatorSelect.val();
                    if (val && val !== '') {
                        operator = String(val);
                    }
                }
                
                
                const referenceValue = $(this).find('.reference-value-input').val();
                const negate = $(this).find('input[name*="[negate]"]').is(':checked');
                // This tab has no picker for a pipeline/pipeline_stage criterion's
                // value (it's not a custom field, so reference_field_id is never
                // set) — that criterion is rendered read-only (see the blade
                // template) and must round-trip via this data attribute instead
                // of being silently dropped by the `referenceFieldId && operator`
                // check below.
                const referenceSource = $(this).data('reference-source') || 'custom_field';

                // Debug: Log each criterion being collected

                if (referenceSource !== 'custom_field' && operator) {
                    group.criteria.push({
                        reference_source: referenceSource,
                        reference_field_id: null,
                        operator: operator,
                        reference_value: (operator === 'exists' || operator === 'boolean') ? null : (referenceValue ? String(referenceValue).trim() : null),
                        negate: Boolean(negate)
                    });
                    hasCriteria = true;
                } else if (referenceFieldId && operator) {
                    // Only require value for operators that need it
                    if (operator !== 'exists' && operator !== 'boolean') {
                        if (!referenceValue || referenceValue.trim() === '') {
                            alert('Please fill in all criterion values');
                            validationError = true;
                            return false; // Exit inner loop
                        }
                    }

                    const criterionData = {
                        reference_source: 'custom_field',
                        reference_field_id: parseInt(referenceFieldId),
                        operator: operator,
                        reference_value: (operator === 'exists' || operator === 'boolean') ? null : (referenceValue ? referenceValue.trim() : null),
                        negate: Boolean(negate)
                    };

                    group.criteria.push(criterionData);
                    hasCriteria = true;
                }
            });

            formData.rule_set.groups.push(group);
        });

        // Stop save operation if validation error occurred
        if (validationError) {
            return; // Stop the save operation
        }

        // Validate
        if ($('#enableRules').is(':checked') && !hasCriteria) {
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
.group-item {
    border: 2px solid #d0d0d0;
}
.group-item .card-header {
    background-color: #f8f9fa;
}
.radio-group label {
    margin-right: 20px;
}
</style>

