<div class="row mb-2 condition-row">
    <div class="col-md-4">
        <select name="conditions[{{ $index }}][field]" class="form-control height-35 f-14 condition-field-select">
            <option value="">-- Select Field --</option>
            <optgroup label="Native Fields">
                <option value="value" data-type="number" {{ ($condition->field ?? '') == 'value' ? 'selected' : '' }}>Deal Value</option>
                <option value="pipeline_stage_id" data-type="number" {{ ($condition->field ?? '') == 'pipeline_stage_id' ? 'selected' : '' }}>Stage</option>
            </optgroup>
            <optgroup label="Hibarr Fields">
                @foreach($hibarrFields as $key => $label)
                    @php
                        $type = 'string';
                        if (in_array($key, ['inspection_trip_date'])) $type = 'date';
                        elseif (in_array($key, ['strategy_meeting_booked', 'downpayment_paid', 'deposit_confirmation', 'reservation_agreement', 'sales_contract'])) $type = 'boolean';
                    @endphp
                    <option value="{{ $key }}" data-type="{{ $type }}" {{ ($condition->field ?? '') == $key ? 'selected' : '' }}>{{ $label }}</option>
                @endforeach
            </optgroup>
            <optgroup label="Related Data">
                @foreach($relatedFields as $key => $label)
                    @php
                        $type = 'string';
                        if (in_array($key, ['followup_count', 'last_followup_days_ago'])) $type = 'number';
                        elseif (in_array($key, ['next_followup_date'])) $type = 'date';
                    @endphp
                    <option value="{{ $key }}" data-type="{{ $type }}" {{ ($condition->field ?? '') == $key ? 'selected' : '' }}>{{ $label }}</option>
                @endforeach
            </optgroup>
            <optgroup label="Custom Fields">
                @foreach($customFields as $field)
                    @php
                        $type = 'string';
                        $values = $field->values; // Expecting array if casted, or string if not.
                        // Try to parse if string and looks like json
                        if (is_string($values) && (str_starts_with($values, '[') || str_starts_with($values, '{'))) {
                             $values = json_decode($values, true);
                        }

                        if ($field->type == 'number') $type = 'number';
                        elseif ($field->type == 'date') $type = 'date';
                        elseif ($field->type == 'radio' || $field->type == 'select') $type = 'select';
                        elseif ($field->type == 'checkbox') $type = 'string'; // Checkbox logic can be complex (array of values), treating as string for now implies text matching
                    @endphp
                    <option value="custom_field_{{ $field->id }}" 
                        data-type="{{ $type }}" 
                        data-values="{{ is_array($values) ? json_encode($values) : $values }}"
                        {{ ($condition->field ?? '') == 'custom_field_'.$field->id ? 'selected' : '' }}>
                        {{ $field->label }}
                    </option>
                @endforeach
            </optgroup>
        </select>
    </div>
    <div class="col-md-3">
        <select name="conditions[{{ $index }}][operator]" class="form-control height-35 f-14 condition-operator-select">
            <option value="=" data-types="string,number,boolean,date,select" {{ ($condition->operator ?? '') == '=' ? 'selected' : '' }}>Equals</option>
            <option value=">" data-types="number,date" {{ ($condition->operator ?? '') == '>' ? 'selected' : '' }}>Greater Than</option>
            <option value="<" data-types="number,date" {{ ($condition->operator ?? '') == '<' ? 'selected' : '' }}>Less Than</option>
            <option value="contains" data-types="string,select" {{ ($condition->operator ?? '') == 'contains' ? 'selected' : '' }}>Contains</option>
            <option value="exists" data-types="string,number,date,boolean,select" {{ ($condition->operator ?? '') == 'exists' ? 'selected' : '' }}>Exists (Not Empty)</option>
            <option value="changed" data-types="string,number,date,boolean,select" {{ ($condition->operator ?? '') == 'changed' ? 'selected' : '' }}>Changed</option>
        </select>
    </div>
    <div class="col-md-4 condition-value-container">
        <input type="text" name="conditions[{{ $index }}][value]" class="form-control height-35 f-14 condition-value-input" value="{{ $condition->value ?? '' }}" placeholder="Value">
    </div>
    <div class="col-md-1">
        <button type="button" class="btn btn-sm btn-danger remove-row"><i class="fa fa-times"></i></button>
    </div>
</div>
