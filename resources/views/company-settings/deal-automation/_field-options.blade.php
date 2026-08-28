{{-- Shared <option>/<optgroup> list for Deal/Lead field pickers (automation conditions,
     email template variable mappings). Expects $selectedField (string, may be ''), plus
     $hibarrFields, $relatedFields, $customFields, $leadFields, $leadCustomFields in scope. --}}
@php $selectedField = $selectedField ?? ''; @endphp
<optgroup label="Native Fields" class="subject-group-deal">
    <option value="value" data-type="number" {{ $selectedField == 'value' ? 'selected' : '' }}>Deal Value</option>
    <option value="pipeline_stage_id" data-type="number" {{ $selectedField == 'pipeline_stage_id' ? 'selected' : '' }}>Stage</option>
</optgroup>
<optgroup label="Hibarr Fields" class="subject-group-deal">
    @foreach($hibarrFields as $key => $label)
        @php
            $type = 'string';
            if (in_array($key, ['inspection_trip_date'])) $type = 'date';
            elseif (in_array($key, ['strategy_meeting_booked', 'downpayment_paid', 'deposit_confirmation', 'reservation_agreement', 'sales_contract'])) $type = 'boolean';
        @endphp
        <option value="{{ $key }}" data-type="{{ $type }}" {{ $selectedField == $key ? 'selected' : '' }}>{{ $label }}</option>
    @endforeach
</optgroup>
<optgroup label="Related Data" class="subject-group-deal">
    @foreach($relatedFields as $key => $label)
        @php
            $type = 'string';
            if (in_array($key, ['followup_count', 'last_followup_days_ago'])) $type = 'number';
            elseif (in_array($key, ['next_followup_date'])) $type = 'date';
        @endphp
        <option value="{{ $key }}" data-type="{{ $type }}" {{ $selectedField == $key ? 'selected' : '' }}>{{ $label }}</option>
    @endforeach
</optgroup>
<optgroup label="Custom Fields" class="subject-group-deal">
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
            {{ $selectedField == 'custom_field_'.$field->id ? 'selected' : '' }}>
            {{ $field->label }}
        </option>
    @endforeach
</optgroup>
@include('company-settings.deal-automation._lead-field-options', ['selectedField' => $selectedField])
