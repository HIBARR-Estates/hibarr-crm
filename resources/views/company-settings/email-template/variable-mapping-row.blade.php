<div class="variable-mapping-row border rounded p-2 mb-2">
    <div class="row align-items-end">
        <div class="col-md-3">
            <label class="f-12 text-dark-grey mb-1">Variable Name</label>
            <input type="text" name="variable_mappings[{{ $index }}][variable]" class="form-control height-35 f-14"
                value="{{ $mapping['variable'] ?? '' }}" placeholder="e.g. customerName">
        </div>
        <div class="col-md-2">
            <label class="f-12 text-dark-grey mb-1 d-block">Maps To</label>
            {{-- Hidden fallback ('field') + checkbox override ('cta_url') sharing
                 one name — classic pattern so an unchecked switch still submits
                 something. A dropdown here ate too much row width for a 2-value choice. --}}
            <input type="hidden" name="variable_mappings[{{ $index }}][type]" value="field">
            <div class="custom-control custom-switch d-flex align-items-center">
                <input type="checkbox" name="variable_mappings[{{ $index }}][type]" value="cta_url"
                    class="custom-control-input variable-mapping-type-switch" id="mapping_type_{{ $index }}"
                    {{ ($mapping['type'] ?? 'field') == 'cta_url' ? 'checked' : '' }}>
                <label class="custom-control-label f-12" for="mapping_type_{{ $index }}">
                    <span class="variable-mapping-type-switch-label">{{ ($mapping['type'] ?? 'field') == 'cta_url' ? 'CTA URL' : 'CRM Field' }}</span>
                </label>
            </div>
        </div>
        <div class="col-md-6 variable-mapping-field-container" style="{{ ($mapping['type'] ?? 'field') != 'field' ? 'display:none;' : '' }}">
            <label class="f-12 text-dark-grey mb-1">CRM Field</label>
            <select name="variable_mappings[{{ $index }}][field]" class="form-control height-35 f-14">
                <option value="">-- Select CRM Field --</option>
                @include('company-settings.deal-automation._field-options', ['selectedField' => $mapping['field'] ?? ''])
            </select>
        </div>
        <div class="col-md-6 variable-mapping-cta-container" style="{{ ($mapping['type'] ?? '') != 'cta_url' ? 'display:none;' : '' }}">
            <label class="f-12 text-dark-grey mb-1">Links To</label>
            <select name="variable_mappings[{{ $index }}][cta_target]" class="form-control height-35 f-14 variable-mapping-cta-target-select">
                @foreach($ctaTargets as $key => $label)
                    <option value="{{ $key }}" {{ ($mapping['cta_target'] ?? 'record') == $key ? 'selected' : '' }}>{{ $label }}</option>
                @endforeach
            </select>
        </div>
        <div class="col-md-1">
            <button type="button" class="btn btn-sm btn-danger remove-row"><i class="fa fa-times"></i></button>
        </div>
    </div>
    <div class="row mt-2 variable-mapping-cta-custom-container" style="{{ ($mapping['type'] ?? '') != 'cta_url' || ($mapping['cta_target'] ?? 'record') != 'custom' ? 'display:none;' : '' }}">
        <div class="col-md-11">
            <label class="f-12 text-dark-grey mb-1">Custom URL</label>
            <input type="text" name="variable_mappings[{{ $index }}][cta_custom_url]" class="form-control height-35 f-14"
                value="{{ $mapping['cta_custom_url'] ?? '' }}" placeholder="https://example.com/book?email=@{{lead_field_client_email}}">
        </div>
    </div>
</div>
