{{-- Reusable "insert tag" button — lets you pick a merge tag from every
     available field instead of having to know/remember the exact @{{tag}}
     syntax, then inserts it at the current cursor position in the field
     named by $targetId (that element's own id attribute — the caller must
     set a unique one). Expects $hibarrFields, $relatedFields, $customFields,
     $leadFields, $leadCustomFields already in scope (shared by the whole
     automation editor page). --}}
<div class="dropdown d-inline-block tag-picker-dropdown">
    <button type="button" class="btn btn-sm btn-outline-secondary tag-picker-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" title="Insert a merge tag">
        <i class="fa fa-tags"></i>
    </button>
    <div class="dropdown-menu tag-picker-menu" data-target="{{ $targetId }}" style="max-height: 340px; overflow-y: auto; min-width: 260px;">
        <h6 class="dropdown-header">Deal Fields</h6>
        <a href="javascript:;" class="dropdown-item tag-picker-item" data-tag="name">Deal Name</a>
        <a href="javascript:;" class="dropdown-item tag-picker-item" data-tag="value">Deal Value</a>
        <h6 class="dropdown-header">Hibarr Fields</h6>
        @foreach($hibarrFields as $key => $label)
            <a href="javascript:;" class="dropdown-item tag-picker-item" data-tag="{{ $key }}">{{ $label }}</a>
        @endforeach
        <h6 class="dropdown-header">Related Data</h6>
        @foreach($relatedFields as $key => $label)
            <a href="javascript:;" class="dropdown-item tag-picker-item" data-tag="{{ $key }}">{{ $label }}</a>
        @endforeach
        @if($customFields->isNotEmpty())
            <h6 class="dropdown-header">Deal Custom Fields</h6>
            @foreach($customFields as $field)
                <a href="javascript:;" class="dropdown-item tag-picker-item" data-tag="custom_field_{{ $field->id }}">{{ $field->label }}</a>
            @endforeach
        @endif
        <h6 class="dropdown-header">Lead Fields</h6>
        @foreach($leadFields as $key => $label)
            <a href="javascript:;" class="dropdown-item tag-picker-item" data-tag="lead_field_{{ $key }}">{{ $label }}</a>
        @endforeach
        @if($leadCustomFields->isNotEmpty())
            <h6 class="dropdown-header">Lead Custom Fields</h6>
            @foreach($leadCustomFields as $field)
                <a href="javascript:;" class="dropdown-item tag-picker-item" data-tag="lead_custom_field_{{ $field->id }}">{{ $field->label }}</a>
            @endforeach
        @endif
    </div>
</div>
