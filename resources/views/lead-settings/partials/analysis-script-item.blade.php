{{--
    Renders one analysis script item row.
    Variables: $item (object with type, item_key, label_override, guide_text) OR inline $type/$key/$label for new rows.
    The JS cloneItem() function renders new rows by calling this same structure via a JS template.
--}}
@php
    $type         = $item->type         ?? $type         ?? '';
    $key          = $item->item_key     ?? $key          ?? '';
    $labelDefault = $item->label_override ?? $label      ?? '';
    $guideText    = $item->guide_text   ?? '';

    $badgeClass = match($type) {
        'custom_field_category' => 'badge-secondary',
        'native_field'          => 'badge-primary',
        'hibarr_field'          => 'badge-info',
        'lead_field'            => 'badge-warning',
        default                 => 'badge-light',
    };
    $badgeLabel = match($type) {
        'custom_field_category' => 'Fields',
        'native_field'          => 'Deal',
        'hibarr_field'          => 'HIBARR',
        'lead_field'            => 'Lead',
        default                 => $type,
    };
@endphp
<div class="d-flex align-items-start p-2 bg-white border rounded mb-2 analysis-item-row" style="gap:8px;">
    {{-- Drag handle --}}
    <span class="drag-handle text-lightest mt-1 cursor-move" style="font-size:16px;line-height:1;">&#9776;</span>

    <div class="flex-grow-1" style="min-width:0;">
        {{-- Header row: badge + key label --}}
        <div class="d-flex align-items-center mb-1" style="gap:6px;">
            <span class="badge {{ $badgeClass }}" style="font-size:10px;white-space:nowrap;">{{ $badgeLabel }}</span>
            <span class="f-12 text-dark font-weight-semibold item-key-label">{{ $key }}</span>
        </div>

        {{-- Label override --}}
        <div class="mb-1">
            <input type="text"
                class="form-control form-control-sm item-label-override"
                placeholder="Label (leave blank for default)"
                value="{{ $labelDefault }}"
                style="font-size:12px;">
        </div>

        {{-- Guide text --}}
        <div class="collapse analysis-guide-collapse {{ $guideText ? 'show' : '' }}" id="">
            <textarea
                class="form-control form-control-sm item-guide-text mt-1"
                rows="3"
                placeholder="Agent talking points / script for this step…"
                style="font-size:12px;resize:vertical;">{{ $guideText }}</textarea>
        </div>
        <a href="#" class="toggle-guide-text f-11 text-muted mt-1 d-inline-block">
            {{ $guideText ? '▲ Hide talking points' : '▼ Add talking points' }}
        </a>
    </div>

    {{-- Remove --}}
    <button type="button" class="btn btn-link text-danger p-0 remove-analysis-item" title="Remove" style="font-size:14px;line-height:1;">
        <i class="fa fa-times"></i>
    </button>
</div>
