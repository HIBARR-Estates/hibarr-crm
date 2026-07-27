@php
    use App\Services\PackageRoutingFieldCatalog;

    $rowIndex = $index ?? 0;
    $trigger = $trigger ?? [
        'field_key' => '',
        'match_mode' => PackageRoutingFieldCatalog::MATCH_MODE_EXACT,
        'match_value' => '',
    ];
    $fieldItems = $fieldItems ?? [];
    $matchModeOptions = $matchModeOptions ?? PackageRoutingFieldCatalog::MATCH_MODES;
    $matchMode = $trigger['match_mode'] ?? PackageRoutingFieldCatalog::MATCH_MODE_EXACT;
    $selectedFieldKey = trim((string) ($trigger['field_key'] ?? ''));
    $matchValueReadOnly = $matchMode === PackageRoutingFieldCatalog::MATCH_MODE_PRESENT;
    $isStaleField = $selectedFieldKey !== '' && collect($fieldItems)->contains(
        fn (array $item) => ($item['value'] ?? '') === $selectedFieldKey && !empty($item['stale']),
    );
@endphp

<div class="package-routing-trigger-row mb-3" data-index="{{ $rowIndex }}">
    @if($isStaleField)
        <p class="f-12 text-warning mb-2">@lang('modules.deal.routingTriggerFieldDisabledRow')</p>
    @endif
    <div class="row align-items-end">
        <div class="col-md-4">
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
                :fieldLabel="null"
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
                :fieldLabel="null"
                :fieldName="'routing_triggers[' . $rowIndex . '][match_value]'"
                :fieldPlaceholder="__('modules.deal.routingTriggerMatchValuePlaceholder')"
                :fieldValue="$trigger['match_value'] ?? ''"
                :fieldReadOnly="$matchValueReadOnly ? 'true' : 'false'" />
        </div>
        <div class="col-md-2 d-flex align-items-center">
            <x-forms.button-secondary
                type="button"
                class="remove-routing-trigger mb-3"
                icon="trash" />
        </div>
    </div>
</div>
