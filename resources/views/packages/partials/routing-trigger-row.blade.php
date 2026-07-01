@php
    use App\Services\PackageRoutingFieldCatalog;

    $rowIndex = $index ?? 0;
    $trigger = $trigger ?? [
        'field_key' => '',
        'match_mode' => PackageRoutingFieldCatalog::MATCH_MODE_EXACT,
        'match_value' => '',
    ];
    $showLabels = $showLabels ?? false;
    $fieldOptions = $fieldOptions ?? [];
    $matchModeOptions = $matchModeOptions ?? PackageRoutingFieldCatalog::MATCH_MODES;
    $matchMode = $trigger['match_mode'] ?? PackageRoutingFieldCatalog::MATCH_MODE_EXACT;
@endphp

<div class="row package-routing-trigger-row mb-2" data-index="{{ $rowIndex }}">
    <div class="col-md-4">
        <x-forms.select
            :fieldId="'routing_trigger_field_' . $rowIndex"
            :fieldLabel="$showLabels ? __('modules.deal.routingTriggerField') : null"
            :fieldName="'routing_triggers[' . $rowIndex . '][field_key]'"
            search="true">
            <option value="">@lang('app.select')</option>
            @foreach($fieldOptions as $fieldKey => $fieldLabel)
                <option value="{{ $fieldKey }}" @selected(($trigger['field_key'] ?? '') === $fieldKey)>{{ $fieldLabel }}</option>
            @endforeach
        </x-forms.select>
    </div>
    <div class="col-md-3">
        <x-forms.select
            :fieldId="'routing_trigger_mode_' . $rowIndex"
            :fieldLabel="$showLabels ? __('modules.deal.routingTriggerMatchMode') : null"
            :fieldName="'routing_triggers[' . $rowIndex . '][match_mode]'">
            @foreach($matchModeOptions as $modeKey => $modeLabel)
                <option value="{{ $modeKey }}" @selected($matchMode === $modeKey)>{{ $modeLabel }}</option>
            @endforeach
        </x-forms.select>
    </div>
    <div class="col-md-3">
        <x-forms.text
            :fieldId="'routing_trigger_match_' . $rowIndex"
            :fieldLabel="$showLabels ? __('modules.deal.routingTriggerMatchValue') : null"
            :fieldName="'routing_triggers[' . $rowIndex . '][match_value]'"
            :fieldPlaceholder="__('modules.deal.routingTriggerMatchValuePlaceholder')"
            :fieldValue="$trigger['match_value'] ?? ''"
            :fieldReadOnly="$matchMode === PackageRoutingFieldCatalog::MATCH_MODE_PRESENT ? 'true' : 'false'" />
    </div>
    <div class="col-md-2 d-flex align-items-end">
        <x-forms.button-secondary
            type="button"
            :class="'remove-routing-trigger mb-3' . (($showRemove ?? true) ? '' : ' d-none')"
            icon="trash" />
    </div>
</div>
