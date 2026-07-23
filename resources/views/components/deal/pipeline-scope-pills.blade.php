@props([
    'inputName',
    'items' => [],
    'selected' => [],
    'fieldIdPrefix' => 'scope',
    'hint' => null,
    'searchPlaceholder' => null,
    'maxSelection' => null,
    'showCount' => true,
])

@php
    $options = collect($items)->map(function ($item) {
        return [
            'value' => is_array($item) ? (string) ($item['value'] ?? '') : (string) $item,
            'label' => is_array($item) ? (string) ($item['label'] ?? '') : (string) $item,
        ];
    })->filter(fn ($item) => $item['value'] !== '')->values()->all();

    $selectedValues = collect($selected)->map(fn ($value) => (string) $value)->values()->all();
    $widgetId = $fieldIdPrefix . '_' . md5($inputName);
@endphp

<div {{ $attributes->merge(['class' => 'pipeline-scope-pills form-group my-3']) }}
    data-widget-id="{{ $widgetId }}"
    data-input-name="{{ $inputName }}"
    data-options='@json($options)'
    data-selected='@json($selectedValues)'
    data-search-placeholder="{{ $searchPlaceholder ?? __('app.search') }}"
    data-count-label="{{ __('modules.deal.pipelineScopeSelectedCount', ['count' => ':count']) }}"
    data-no-matches="{{ __('modules.deal.pipelineScopeNoMatches') }}"
    data-all-selected="{{ __('modules.deal.pipelineScopeAllSelected') }}"
    @if($maxSelection !== null)
    data-max-selection="{{ (int) $maxSelection }}"
    @endif
    data-show-count="{{ $showCount ? '1' : '0' }}">

    <div class="pipeline-scope-pills__pills d-flex flex-wrap"></div>

    <div class="position-relative">
        <input type="text"
            class="form-control height-35 f-14 pipeline-scope-pills__search"
            placeholder="{{ $searchPlaceholder ?? __('app.search') }}"
            autocomplete="off"
            aria-label="{{ $searchPlaceholder ?? __('app.search') }}">
        <div class="pipeline-scope-pills__dropdown d-none"></div>
    </div>

    <div class="pipeline-scope-pills__hidden-inputs"></div>

    <p class="pipeline-scope-pills__count f-11 text-lightest mt-1 mb-0"></p>

    @if($hint)
        <p class="f-11 text-lightest mt-1 mb-0">{{ $hint }}</p>
    @endif
</div>
