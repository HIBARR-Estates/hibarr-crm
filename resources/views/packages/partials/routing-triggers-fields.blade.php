@php
    use App\Services\PackageRoutingFieldCatalog;

    $triggerRows = old('routing_triggers', $routingTriggers ?? []);
    if (empty($triggerRows)) {
        $triggerRows = [[
            'field_key' => '',
            'match_mode' => PackageRoutingFieldCatalog::MATCH_MODE_EXACT,
            'match_value' => '',
        ]];
    }
    $fieldOptions = $routingFieldOptions ?? [];
    $matchModeOptions = $routingMatchModeOptions ?? PackageRoutingFieldCatalog::MATCH_MODES;
@endphp

<div class="col-sm-12">
    <hr class="my-3">
    <h4 class="mb-2 f-16 font-weight-normal">@lang('modules.deal.packageRoutingTriggers')</h4>
    <p class="f-11 text-lightest mb-3">@lang('modules.deal.packageRoutingTriggersHint')</p>
</div>

<div class="col-sm-12">
    <div id="package-routing-triggers">
        @foreach($triggerRows as $index => $trigger)
            @include('packages.partials.routing-trigger-row', [
                'index' => $index,
                'trigger' => $trigger,
                'showLabels' => $loop->first,
                'showRemove' => count($triggerRows) > 1,
                'fieldOptions' => $fieldOptions,
                'matchModeOptions' => $matchModeOptions,
            ])
        @endforeach
    </div>

    <x-forms.button-secondary type="button" id="add-routing-trigger" icon="plus" class="mt-1">
        @lang('modules.deal.addRoutingTrigger')
    </x-forms.button-secondary>
</div>

<div id="package-routing-trigger-row-template" class="d-none">
    @include('packages.partials.routing-trigger-row', [
        'index' => '__INDEX__',
        'trigger' => [
            'field_key' => '',
            'match_mode' => PackageRoutingFieldCatalog::MATCH_MODE_EXACT,
            'match_value' => '',
        ],
        'showLabels' => false,
        'showRemove' => true,
        'fieldOptions' => $fieldOptions,
        'matchModeOptions' => $matchModeOptions,
    ])
</div>

<script>
    (function () {
        const container = $('#package-routing-triggers');
        const templateHtml = $('#package-routing-trigger-row-template').html();
        const presentMode = @json(PackageRoutingFieldCatalog::MATCH_MODE_PRESENT);

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
            scope.find('.select-picker').each(function () {
                if ($(this).data('selectpicker')) {
                    $(this).selectpicker('destroy');
                }
                $(this).selectpicker();
            });
        }

        function reindexRows() {
            container.find('.package-routing-trigger-row').each(function (rowIndex) {
                const row = $(this);
                row.attr('data-index', rowIndex);

                row.find('select[name*="[field_key]"]').attr({
                    name: `routing_triggers[${rowIndex}][field_key]`,
                    id: `routing_trigger_field_${rowIndex}`,
                });
                row.find('select[name*="[match_mode]"]').attr({
                    name: `routing_triggers[${rowIndex}][match_mode]`,
                    id: `routing_trigger_mode_${rowIndex}`,
                });
                row.find('input[name*="[match_value]"]').attr({
                    name: `routing_triggers[${rowIndex}][match_value]`,
                    id: `routing_trigger_match_${rowIndex}`,
                });
            });

            const rowCount = container.find('.package-routing-trigger-row').length;
            container.find('.remove-routing-trigger').toggle(rowCount > 1);
        }

        container.on('change', 'select[name*="[match_mode]"]', function () {
            toggleMatchValueInput($(this).closest('.package-routing-trigger-row'));
        });

        container.find('.package-routing-trigger-row').each(function () {
            toggleMatchValueInput($(this));
        });

        $('#add-routing-trigger').on('click', function () {
            const rowIndex = container.find('.package-routing-trigger-row').length;
            const rowHtml = templateHtml.replace(/__INDEX__/g, rowIndex);
            const row = $(rowHtml.trim());

            container.append(row);
            initSelectPickers(row);
            reindexRows();
        });

        container.on('click', '.remove-routing-trigger', function () {
            $(this).closest('.package-routing-trigger-row').remove();

            if (container.find('.package-routing-trigger-row').length === 0) {
                $('#add-routing-trigger').trigger('click');
            }

            reindexRows();
        });
    })();
</script>
