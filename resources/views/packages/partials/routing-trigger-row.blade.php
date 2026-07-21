@php
    use App\Services\PackageRoutingFieldCatalog;

    $rowIndex = $index ?? 0;
    $trigger = $trigger ?? [
        'field_key' => '',
        'match_mode' => PackageRoutingFieldCatalog::MATCH_MODE_EXACT,
        'match_value' => '',
    ];
    $showLabels = $showLabels ?? false;
    $fieldItems = $fieldItems ?? [];
    $matchModeOptions = $matchModeOptions ?? PackageRoutingFieldCatalog::MATCH_MODES;
    $matchMode = $trigger['match_mode'] ?? PackageRoutingFieldCatalog::MATCH_MODE_EXACT;
    $selectedFieldKey = trim((string) ($trigger['field_key'] ?? ''));
    $columnLabels = ($showLabels ?? false);
@endphp

<div class="row package-routing-trigger-row mb-2" data-index="{{ $rowIndex }}">
    <div class="col-md-4">
        @if($showLabels)
            <x-forms.label :fieldId="'routing_trigger_field_' . $rowIndex" :fieldLabel="__('modules.deal.routingTriggerField')" />
        @endif
        <x-deal.pipeline-scope-pills
            :inputName="'routing_triggers[' . $rowIndex . '][field_key]'"
            :items="$fieldItems"
            :selected="$selectedFieldKey !== '' ? [$selectedFieldKey] : []"
            :fieldIdPrefix="'routing_pkg_field_' . $rowIndex"
            :searchPlaceholder="__('app.search')"
            :maxSelection="1"
            :showCount="false"
            class="my-0" />
    </div>
    <div class="col-md-3">
        <x-forms.select
            :fieldId="'routing_trigger_mode_' . $rowIndex"
            :fieldLabel="$columnLabels ? __('modules.deal.routingTriggerMatchMode') : null"
            :fieldName="'routing_triggers[' . $rowIndex . '][match_mode]'"
            search="true">
            @foreach($matchModeOptions as $modeKey => $modeLabel)
                <option value="{{ $modeKey }}" @selected($matchMode === $modeKey)>{{ $modeLabel }}</option>
            @endforeach
        </x-forms.select>
    </div>
    <div class="col-md-3">
        <x-forms.text
            :fieldId="'routing_trigger_match_' . $rowIndex"
            :fieldLabel="$columnLabels ? __('modules.deal.routingTriggerMatchValue') : null"
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
