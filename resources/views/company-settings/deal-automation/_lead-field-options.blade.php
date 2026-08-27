{{-- Lead field <optgroup>s — reused both as the "Lead Fields"/"Lead Custom Fields"
     groups on a Deal-subject condition/mapping picker (lead_field_*/lead_custom_field_*
     resolve against the deal's contact), and as the FULL field list on a Lead-subject
     automation (same keys resolve directly against the lead, since it IS the subject).
     Expects $selectedField (string, may be ''), plus $leadFields, $leadCustomFields. --}}
@php $selectedField = $selectedField ?? ''; @endphp
<optgroup label="Lead Fields">
    @foreach($leadFields as $key => $label)
        @php
            $type = 'string';
            if (in_array($key, ['age', 'category_id', 'source_id', 'lead_lifecycle_status_id', 'lead_owner', 'referred_by_agent_id'])) $type = 'number';
            elseif (in_array($key, ['date_of_birth', 'assigned_at', 'first_contacted_at', 'created_at'])) $type = 'date';
        @endphp
        <option value="lead_field_{{ $key }}" data-type="{{ $type }}" {{ $selectedField == 'lead_field_'.$key ? 'selected' : '' }}>{{ $label }}</option>
    @endforeach
</optgroup>
<optgroup label="Lead Custom Fields">
    @foreach($leadCustomFields as $field)
        @php
            $type = 'string';
            $values = $field->values;
            if (is_string($values) && (str_starts_with($values, '[') || str_starts_with($values, '{'))) {
                 $values = json_decode($values, true);
            }

            if ($field->type == 'number') $type = 'number';
            elseif ($field->type == 'date') $type = 'date';
            elseif ($field->type == 'radio' || $field->type == 'select') $type = 'select';
            elseif ($field->type == 'checkbox') $type = 'string';
        @endphp
        <option value="lead_custom_field_{{ $field->id }}"
            data-type="{{ $type }}"
            data-values="{{ is_array($values) ? json_encode($values) : $values }}"
            {{ $selectedField == 'lead_custom_field_'.$field->id ? 'selected' : '' }}>
            {{ $field->label }}
        </option>
    @endforeach
</optgroup>
