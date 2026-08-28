{{-- Date fields for a trigger = 'date_based' automation — the day the scheduler
     compares against "today" (yearly recurrence matches month/day; once matches
     the exact date). Options carry data-subject so filterSelectBySubject() can
     hide groups that don't apply to the automation's subject type. Every key
     must resolve to a parseable date via FieldResolverService::resolve().
     Expects $selectedDateField (string, may be ''), plus $dateFields,
     $customFields, $leadCustomFields. --}}
@php $selectedDateField = $selectedDateField ?? ''; @endphp
@foreach($dateFields['deal'] as $key => $label)
    <option value="{{ $key }}" data-subject="deal" {{ $selectedDateField == $key ? 'selected' : '' }}>{{ $label }}</option>
@endforeach
@foreach($dateFields['lead'] as $key => $label)
    <option value="{{ $key }}" data-subject="lead" {{ $selectedDateField == $key ? 'selected' : '' }}>{{ $label }}</option>
@endforeach
<optgroup label="Deal Custom Fields" class="subject-group-deal">
    @foreach($customFields as $field)
        @if($field->type == 'date')
            <option value="custom_field_{{ $field->id }}" data-subject="deal" {{ $selectedDateField == 'custom_field_'.$field->id ? 'selected' : '' }}>{{ $field->label }}</option>
        @endif
    @endforeach
</optgroup>
<optgroup label="Client (Lead) Custom Fields">
    @foreach($leadCustomFields as $field)
        @if($field->type == 'date')
            <option value="lead_custom_field_{{ $field->id }}" data-subject="any" {{ $selectedDateField == 'lead_custom_field_'.$field->id ? 'selected' : '' }}>{{ $field->label }}</option>
        @endif
    @endforeach
</optgroup>
