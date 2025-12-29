@extends('layouts.app')

@section('content')

    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        @lang($pageTitle)
                    </h2>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
                @if(isset($automation->id))
                    <form method="POST" id="save-automation-form" action="{{ route('deal-automations.update', $automation->id) }}">
                    @method('PUT')
                @else
                    <form method="POST" id="save-automation-form" action="{{ route('deal-automations.store') }}">
                @endif
                @csrf

                <div class="alert alert-info mb-4">
                    <h5 class="alert-heading f-14 font-weight-bold"><i class="fa fa-info-circle"></i> How Automations Work</h5>
                    <p class="mb-0 f-13">
                        This rule runs only when the selected trigger event happens. It does not lock the deal state. 
                        If a user manually moves a deal, this automation will not revert it unless a new event triggers the rule again.
                    </p>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <x-forms.text fieldId="name" :fieldLabel="__('app.name')" fieldName="name" fieldRequired="true"
                            :fieldValue="$automation->name ?? ''" />
                    </div>
                    <div class="col-md-3">
                        <x-forms.number fieldId="priority" :fieldLabel="__('Priority')" fieldName="priority" fieldRequired="true"
                            :fieldValue="$automation->priority ?? 0" fieldHelp="Higher number runs first" />
                    </div>
                    <div class="col-md-3">
                        <div class="form-group my-3">
                            <x-forms.checkbox fieldId="active" :fieldLabel="__('app.active')" fieldName="active"
                                :checked="$automation->active ?? true" />
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <x-forms.select fieldId="pipeline_id" :fieldLabel="__('Pipeline Scope')" fieldName="pipeline_id" fieldRequired="true">
                            @foreach($pipelines as $pipeline)
                                <option value="{{ $pipeline->id }}" {{ ($automation->pipeline_id ?? '') == $pipeline->id ? 'selected' : '' }}>
                                    {{ $pipeline->name }}
                                </option>
                            @endforeach
                        </x-forms.select>
                    </div>
                    <div class="col-md-6">
                        <x-forms.select fieldId="trigger" :fieldLabel="__('Trigger (Optional)')" fieldName="trigger">
                            <option value="">-- Run on Any Update --</option>
                            <option value="deal_created" {{ ($automation->trigger ?? '') == 'deal_created' ? 'selected' : '' }}>Deal Created</option>
                            <option value="deal_updated" {{ ($automation->trigger ?? '') == 'deal_updated' ? 'selected' : '' }}>Deal Updated</option>
                            <option value="followup_created" {{ ($automation->trigger ?? '') == 'followup_created' ? 'selected' : '' }}>Follow-up Created</option>
                            <option value="custom_field_updated" {{ ($automation->trigger ?? '') == 'custom_field_updated' ? 'selected' : '' }}>Custom Field Updated</option>
                        </x-forms.select>
                        <p class="f-11 text-lightest mt-1" id="trigger-help-text">
                            @if(($automation->trigger ?? '') == '')
                                Evaluates whenever a deal is created or updated.
                            @elseif(($automation->trigger ?? '') == 'deal_created')
                                Evaluates only when a new deal is created.
                            @elseif(($automation->trigger ?? '') == 'deal_updated')
                                Evaluates when a deal's properties are updated.
                            @elseif(($automation->trigger ?? '') == 'followup_created')
                                Evaluates when a follow-up is added to the deal.
                            @elseif(($automation->trigger ?? '') == 'custom_field_updated')
                                Evaluates when a custom field value changes.
                            @endif
                        </p>
                        <div id="trigger-warning" class="alert alert-warning f-13 mt-2 p-2" style="display: none;">
                            <i class="fa fa-exclamation-triangle"></i> <strong>Note:</strong> This rule evaluates every time a deal is saved. Ensure your conditions are specific to avoid unintended stage changes.
                        </div>
                    </div>
                </div>

                <hr>
                <h4 class="mb-3">Conditions</h4>
                <div id="conditions-container">
                    @if(isset($automation) && $automation->conditions->count() > 0)
                        @foreach($automation->conditions as $index => $condition)
                            @include('company-settings.deal-automation.condition-row', ['index' => $index, 'condition' => $condition])
                        @endforeach
                    @else
                        @include('company-settings.deal-automation.condition-row', ['index' => 0, 'condition' => null])
                    @endif
                </div>
                <button type="button" class="btn btn-sm btn-secondary mt-2" id="add-condition"><i class="fa fa-plus"></i> Add Condition</button>

                <hr>
                <h4 class="mb-3">Actions</h4>
                <div id="actions-container">
                    @if(isset($automation) && $automation->actions->count() > 0)
                        @foreach($automation->actions as $index => $action)
                            @include('company-settings.deal-automation.action-row', ['index' => $index, 'action' => $action])
                        @endforeach
                    @else
                        @include('company-settings.deal-automation.action-row', ['index' => 0, 'action' => null])
                    @endif
                </div>
                <button type="button" class="btn btn-sm btn-secondary mt-2" id="add-action"><i class="fa fa-plus"></i> Add Action</button>

                </form>
            </div>

            <x-slot name="action">
                <div class="w-100 border-top-grey">
                    <x-setting-form-actions>
                        <x-forms.button-primary id="save-automation" icon="check">@lang('app.save')</x-forms.button-primary>
                        <x-forms.button-cancel :link="route('company-settings.deal_automations')" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
                    </x-setting-form-actions>
                </div>
            </x-slot>

        </x-setting-card>

    </div>

    {{-- Templates for JS --}}
    <script type="text/template" id="condition-template">
        @include('company-settings.deal-automation.condition-row', ['index' => 'INDEX', 'condition' => null])
    </script>
    <script type="text/template" id="action-template">
        @include('company-settings.deal-automation.action-row', ['index' => 'INDEX', 'action' => null])
    </script>

@endsection

@push('scripts')
    <script>
        $(document).ready(function() {
            let conditionIndex = {{ isset($automation) ? $automation->conditions->count() : 1 }};
            let actionIndex = {{ isset($automation) ? $automation->actions->count() : 1 }};

            $('#add-condition').click(function() {
                let template = $('#condition-template').html();
                template = template.replace(/INDEX/g, conditionIndex);
                $('#conditions-container').append(template);
                conditionIndex++;
            });

            $('#add-action').click(function() {
                let template = $('#action-template').html();
                template = template.replace(/INDEX/g, actionIndex);
                $('#actions-container').append(template);
                actionIndex++;
            });

            $('body').on('click', '.remove-row', function() {
                $(this).closest('.row').remove();
            });

            // Trigger Help Text Logic
            const triggerHelp = {
                '': 'Evaluates whenever a deal is created or updated.',
                'deal_created': 'Evaluates only when a new deal is created.',
                'deal_updated': 'Evaluates when a deal\'s properties are updated.',
                'followup_created': 'Evaluates when a follow-up is added to the deal.',
                'custom_field_updated': 'Evaluates when a custom field value changes.'
            };

            $('#trigger').change(function() {
                const val = $(this).val();
                $('#trigger-help-text').text(triggerHelp[val] || '');
                
                if (val === 'deal_updated') {
                    $('#trigger-warning').slideDown();
                } else {
                    $('#trigger-warning').slideUp();
                }
            });

            // Condition Builder Logic
            function updateOperators(row) {
                const fieldSelect = row.find('.condition-field-select');
                const operatorSelect = row.find('.condition-operator-select');
                const selectedOption = fieldSelect.find('option:selected');
                const fieldType = selectedOption.data('type') || 'string';

                operatorSelect.find('option').each(function() {
                    const supportedTypes = $(this).data('types');
                    if (supportedTypes && supportedTypes.split(',').includes(fieldType)) {
                        $(this).show();
                        $(this).prop('disabled', false);
                    } else {
                        $(this).hide();
                        $(this).prop('disabled', true);
                    }
                });

                // If currently selected operator is disabled, select the first enabled one
                if (operatorSelect.find('option:selected').prop('disabled')) {
                    operatorSelect.val(operatorSelect.find('option:not(:disabled):first').val());
                }
            }

            $('body').on('change', '.condition-field-select', function() {
                updateOperators($(this).closest('.condition-row'));
            });

            // Initialize operators for existing rows
            $('.condition-row').each(function() {
                updateOperators($(this));
            });

            // Also initialize when adding a new row
            $('#add-condition').click(function() {
                // Wait for the row to be appended
                setTimeout(function() {
                    updateOperators($('#conditions-container .condition-row:last'));
                }, 0);
            });

            // Action Builder Logic
            function updateStageOptions(row) {
                const pipelineSelect = row.find('.action-pipeline-select');
                const stageSelect = row.find('.action-stage-select');
                let targetPipelineId = pipelineSelect.val();

                // If no target pipeline selected, use the main pipeline scope
                if (!targetPipelineId) {
                    targetPipelineId = $('#pipeline_id').val();
                }

                stageSelect.find('option').each(function() {
                    const option = $(this);
                    const optionPipelineId = option.data('pipeline-id');
                    
                    // Always show the placeholder
                    if (option.val() === "") {
                        option.show();
                        return;
                    }

                    if (optionPipelineId == targetPipelineId) {
                        option.show();
                        option.prop('disabled', false);
                    } else {
                        option.hide();
                        option.prop('disabled', true);
                    }
                });

                // If currently selected stage is now hidden/disabled, reset selection
                const selectedOption = stageSelect.find('option:selected');
                if (selectedOption.val() !== "" && (selectedOption.css('display') === 'none' || selectedOption.prop('disabled'))) {
                    stageSelect.val("");
                }
            }

            $('body').on('change', '.action-pipeline-select', function() {
                updateStageOptions($(this).closest('.action-row'));
            });

            $('#pipeline_id').change(function() {
                $('.action-row').each(function() {
                    updateStageOptions($(this));
                });
            });

            // Initialize stages for existing rows
            $('.action-row').each(function() {
                updateStageOptions($(this));
            });

            // Also initialize when adding a new row
            $('#add-action').click(function() {
                setTimeout(function() {
                    updateStageOptions($('#actions-container .action-row:last'));
                }, 0);
            });

            // Forward Only Warning Logic
            $('body').on('change', '.forward-only-check', function() {
                const container = $(this).closest('.col-md-3');
                if (!$(this).is(':checked')) {
                    container.find('.forward-only-help').hide();
                    container.find('.forward-only-warning').show();
                } else {
                    container.find('.forward-only-help').show();
                    container.find('.forward-only-warning').hide();
                }
            });
            
            // Initialize forward only warnings
            $('.forward-only-check').trigger('change');

            $('#save-automation').click(function() {
                $.easyAjax({
                    url: $('#save-automation-form').attr('action'),
                    container: '#save-automation-form',
                    type: "POST",
                    disableButton: true,
                    blockUI: true,
                    buttonSelector: "#save-automation",
                    data: $('#save-automation-form').serialize(),
                    redirect: true
                })
            });
        });
    </script>
@endpush
