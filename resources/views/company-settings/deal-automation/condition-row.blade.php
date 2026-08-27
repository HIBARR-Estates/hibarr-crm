<div class="row mb-2 condition-row">
    <div class="col-md-4">
        <select name="conditions[{{ $index }}][field]" class="form-control height-35 f-14 condition-field-select">
            <option value="">-- Select Field --</option>
            @include('company-settings.deal-automation._field-options', ['selectedField' => $condition->field ?? ''])
        </select>
    </div>
    <div class="col-md-3">
        <select name="conditions[{{ $index }}][operator]" class="form-control height-35 f-14 condition-operator-select">
            <option value="=" data-types="string,number,boolean,date,select" {{ ($condition->operator ?? '') == '=' ? 'selected' : '' }}>Equals</option>
            <option value=">" data-types="number,date" {{ ($condition->operator ?? '') == '>' ? 'selected' : '' }}>Greater Than</option>
            <option value="<" data-types="number,date" {{ ($condition->operator ?? '') == '<' ? 'selected' : '' }}>Less Than</option>
            <option value="contains" data-types="string,select" {{ ($condition->operator ?? '') == 'contains' ? 'selected' : '' }}>Contains</option>
            <option value="exists" data-types="string,number,date,boolean,select" {{ ($condition->operator ?? '') == 'exists' ? 'selected' : '' }}>Exists (Not Empty)</option>
            <option value="changed" data-types="string,number,date,boolean,select" {{ ($condition->operator ?? '') == 'changed' ? 'selected' : '' }}>Changed</option>
        </select>
    </div>
    <div class="col-md-4 condition-value-container">
        <input type="text" name="conditions[{{ $index }}][value]" class="form-control height-35 f-14 condition-value-input" value="{{ $condition->value ?? '' }}" placeholder="Value">
    </div>
    <div class="col-md-1">
        <button type="button" class="btn btn-sm btn-danger remove-row"><i class="fa fa-times"></i></button>
    </div>
</div>
