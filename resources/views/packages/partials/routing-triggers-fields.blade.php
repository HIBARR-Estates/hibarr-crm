@php
    use App\Services\PackageRoutingFieldCatalog;

    $triggerRows = old('routing_triggers', $routingTriggers ?? []);
    $triggerRows = is_array($triggerRows) ? array_values($triggerRows) : [];
    $fieldItems = $routingTriggerFieldItems ?? [];
    $matchModeOptions = $routingMatchModeOptions ?? PackageRoutingFieldCatalog::MATCH_MODES;
    $routingFieldsConfigured = $fieldItems !== [];
@endphp

<div class="col-sm-12">
    <hr class="my-3">
    <h4 class="mb-2 f-16 font-weight-normal">@lang('modules.deal.packageRoutingTriggers')</h4>
    <p class="f-11 text-lightest mb-3">@lang('modules.deal.packageRoutingTriggersHint')</p>
    @unless($routingFieldsConfigured)
        <p class="f-12 text-warning mb-0">@lang('modules.deal.packageRoutingTriggersNoFields')</p>
    @endunless
</div>

@if($routingFieldsConfigured)
<div class="col-sm-12">
    <div id="package-routing-triggers-header" class="row {{ count($triggerRows) === 0 ? 'd-none' : '' }}">
        <div class="col-md-4">
            <x-forms.label fieldId="routing_triggers_header_field" :fieldLabel="__('modules.deal.routingTriggerField')" />
        </div>
        <div class="col-md-3">
            <x-forms.label fieldId="routing_triggers_header_mode" :fieldLabel="__('modules.deal.routingTriggerMatchMode')" />
        </div>
        <div class="col-md-3">
            <x-forms.label fieldId="routing_triggers_header_value" :fieldLabel="__('modules.deal.routingTriggerMatchValue')" />
        </div>
        <div class="col-md-2"></div>
    </div>

    <div id="package-routing-triggers">
        @foreach($triggerRows as $index => $trigger)
            @include('packages.partials.routing-trigger-row', [
                'index' => $index,
                'trigger' => $trigger,
                'fieldItems' => $fieldItems,
                'matchModeOptions' => $matchModeOptions,
            ])
        @endforeach
    </div>

    <x-forms.button-secondary type="button" id="add-routing-trigger" icon="plus" class="mt-1">
        @lang('modules.deal.addRoutingTrigger')
    </x-forms.button-secondary>
</div>

<template id="package-routing-trigger-row-template">
    @include('packages.partials.routing-trigger-row', [
        'index' => '__INDEX__',
        'trigger' => [
            'field_key' => '',
            'match_mode' => PackageRoutingFieldCatalog::MATCH_MODE_EXACT,
            'match_value' => '',
        ],
        'fieldItems' => $fieldItems,
        'matchModeOptions' => $matchModeOptions,
    ])
</template>

@include('components.deal.partials.pipeline-scope-pills-init')

<script>
    (function () {
        const container = $('#package-routing-triggers');
        const templateEl = document.getElementById('package-routing-trigger-row-template');
        const presentMode = @json(PackageRoutingFieldCatalog::MATCH_MODE_PRESENT);

        function templateHtml() {
            if (templateEl instanceof HTMLTemplateElement) {
                return templateEl.innerHTML.trim();
            }

            return $(templateEl).html().trim();
        }

        function toggleMatchValueInput(row) {
            const mode = row.find('select[name*="[match_mode]"]').val();
            const input = row.find('input[name*="[match_value]"]');
            const isPresent = mode === presentMode;

            input.prop('readonly', isPresent);
            if (isPresent) {
                input.val('');
            }
        }

        function initSelectPickers(scope) {
            scope.find('select.select-picker[name*="[match_mode]"]').each(function () {
                const $select = $(this);
                if ($select.data('selectpicker')) {
                    $select.selectpicker('destroy');
                }
                $select.selectpicker({
                    container: 'body',
                    dropupAuto: true,
                    windowPadding: 12,
                });
            });
        }

        function updateTriggersChrome() {
            const rowCount = container.find('.package-routing-trigger-row').length;
            $('#package-routing-triggers-header').toggleClass('d-none', rowCount === 0);
        }

        function reindexRows() {
            container.find('.package-routing-trigger-row').each(function (rowIndex) {
                const row = $(this);
                row.attr('data-index', rowIndex);

                const fieldInputName = `routing_triggers[${rowIndex}][field_key]`;
                row.find('.pipeline-scope-pills').attr('data-input-name', fieldInputName);

                const modeSelect = row.find('select[name*="[match_mode]"]');
                if (modeSelect.data('selectpicker')) {
                    modeSelect.selectpicker('destroy');
                }
                modeSelect.attr({
                    name: `routing_triggers[${rowIndex}][match_mode]`,
                    id: `routing_trigger_mode_${rowIndex}`,
                });
                row.find('input[name*="[match_value]"]').attr({
                    name: `routing_triggers[${rowIndex}][match_value]`,
                    id: `routing_trigger_match_${rowIndex}`,
                });
            });

            initSelectPickers(container);

            if (typeof window.syncPipelineScopePillsInputs === 'function') {
                window.syncPipelineScopePillsInputs(container);
            }

            updateTriggersChrome();
        }

        window.preparePackageRoutingTriggersForSubmit = function ($form) {
            reindexRows();

            if (typeof window.syncPipelineScopePillsInputs === 'function') {
                window.syncPipelineScopePillsInputs($form || container);
            }
        };

        container.on('changed.bs.select', 'select[name*="[match_mode]"]', function () {
            toggleMatchValueInput($(this).closest('.package-routing-trigger-row'));
        });

        container.on('change', 'select[name*="[match_mode]"]', function () {
            toggleMatchValueInput($(this).closest('.package-routing-trigger-row'));
        });

        container.find('.package-routing-trigger-row').each(function () {
            toggleMatchValueInput($(this));
        });

        if (typeof window.initPipelineScopePills === 'function') {
            window.initPipelineScopePills(container);
        }

        initSelectPickers(container);

        $('#add-routing-trigger').on('click', function () {
            const rowIndex = container.find('.package-routing-trigger-row').length;
            const rowHtml = templateHtml().replace(/__INDEX__/g, rowIndex);
            const row = $(rowHtml.trim());
            row.find('.pipeline-scope-pills').removeAttr('data-pills-init');

            container.append(row);
            initSelectPickers(row);
            if (typeof window.initPipelineScopePills === 'function') {
                window.initPipelineScopePills(row);
            }
            reindexRows();
        });

        container.on('click', '.remove-routing-trigger', function () {
            $(this).closest('.package-routing-trigger-row').remove();
            reindexRows();
        });

        updateTriggersChrome();
    })();
</script>
@endif
