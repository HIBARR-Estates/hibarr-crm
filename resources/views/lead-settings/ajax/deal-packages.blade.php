<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    <div class="alert alert-info mb-4">
        <h5 class="alert-heading f-14 font-weight-bold">
            <i class="fa fa-info-circle"></i> @lang('modules.deal.dealPackageSettings')
        </h5>
        <p class="mb-0 f-13">@lang('modules.deal.dealPackageSettingsHint')</p>
    </div>

    <x-form id="dealPackageSettingsForm" method="POST">
        @csrf
        @method('PUT')

        <div class="row">
            <div class="col-md-12">
                <x-forms.checkbox
                    :fieldLabel="__('modules.deal.packagePipelineRoutingEnabled')"
                    fieldName="package_pipeline_routing_enabled"
                    fieldId="package_pipeline_routing_enabled"
                    fieldValue="1"
                    :checked="(bool) company()->package_pipeline_routing_enabled" />
            </div>

            <div class="col-md-12 mt-3">
                <x-forms.label fieldId="deal_package_mode_single" :fieldLabel="__('modules.deal.dealPackageMode')" />
                <div class="d-flex flex-column">
                    <x-forms.radio
                        fieldId="deal_package_mode_single"
                        fieldName="deal_package_mode"
                        fieldValue="single"
                        :fieldLabel="__('modules.deal.dealPackageModeSingle')"
                        :checked="company()->deal_package_mode === 'single'" />
                    <x-forms.radio
                        fieldId="deal_package_mode_multiple"
                        fieldName="deal_package_mode"
                        fieldValue="multiple"
                        :fieldLabel="__('modules.deal.dealPackageModeMultiple')"
                        :checked="company()->deal_package_mode !== 'single'" />
                </div>
                <p class="f-11 text-lightest mt-1 mb-0">@lang('modules.deal.dealPackageModeHint')</p>
            </div>

            <div class="col-md-12 mt-3">
                <x-forms.select
                    fieldId="package_pipeline_routing_trigger_fields"
                    :fieldLabel="__('modules.deal.packagePipelineRoutingTriggerFields')"
                    fieldName="package_pipeline_routing_trigger_fields[]"
                    multiple="true"
                    search="true">
                    @foreach($routingFieldOptions ?? [] as $fieldKey => $fieldLabel)
                        <option value="{{ $fieldKey }}" @selected(in_array($fieldKey, $selectedRoutingTriggerFields ?? [], true))>{{ $fieldLabel }}</option>
                    @endforeach
                </x-forms.select>
                <p class="f-11 text-lightest mt-1 mb-0">@lang('modules.deal.packagePipelineRoutingTriggerFieldsHint')</p>
            </div>
        </div>

        <div class="w-100 border-top-grey mt-4">
            <x-setting-form-actions>
                <x-forms.button-primary id="save-deal-package-settings" icon="check">@lang('app.save')</x-forms.button-primary>
            </x-setting-form-actions>
        </div>
    </x-form>
</div>

<script>
    $('#save-deal-package-settings').click(function () {
        $.easyAjax({
            url: "{{ route('lead-settings.deal-package-settings') }}",
            container: '#dealPackageSettingsForm',
            type: 'PUT',
            disableButton: true,
            blockUI: true,
            buttonSelector: '#save-deal-package-settings',
            data: $('#dealPackageSettingsForm').serialize(),
        });
    });
</script>
