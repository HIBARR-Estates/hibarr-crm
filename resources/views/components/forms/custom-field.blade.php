<style>
    .invalid-feedback {
        display: contents;
    }
</style>
@props(['fields', 'model' => null, 'categoryId' => null])
@if (isset($fields) && count($fields) > 0)
    @php
        // Cache JSON decoded values at template level for performance
        $allFieldValues = [];
        foreach ($fields as $field) {
            if (in_array($field->type, ['radio', 'checkbox', 'select'])) {
                $allFieldValues[$field->id] = is_string($field->values) ? json_decode($field->values) : $field->values;
            }
        }
    @endphp
    <div {{ $attributes->merge(['class' => 'row p-20']) }}>
        @foreach ($fields as $field)
            @if (!is_null($categoryId) && $field->custom_field_category_id != $categoryId)
                @continue
            @endif
            <div class="col-md-4">
                <div class="form-group">
                    @if ($field->type == 'text')
                        <x-forms.text
                            fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldLabel="$field->label"
                            fieldName="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldPlaceholder="$field->label"
                            :fieldRequired="($field->required == 'yes') ? 'true' : 'false'"
                            :fieldValue="$model->custom_fields_data['field_'.$field->id] ?? ''">
                        </x-forms.text>

                    @elseif($field->type == 'password')
                        <x-forms.password
                            fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldLabel="$field->label"
                            fieldName="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldPlaceholder="$field->label"
                            :fieldRequired="($field->required === 'yes') ? true : false"
                            :fieldValue="$model->custom_fields_data['field_'.$field->id] ?? ''">
                        </x-forms.password>

                    @elseif($field->type == 'number')
                        <x-forms.number
                            fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldLabel="$field->label"
                            fieldName="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldPlaceholder="$field->label"
                            :fieldRequired="($field->required === 'yes') ? true : false"
                            :fieldValue="$model->custom_fields_data['field_'.$field->id] ?? ''">
                        </x-forms.number>

                    @elseif($field->type == 'textarea')
                        <x-forms.textarea :fieldLabel="$field->label"
                                          fieldName="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                                          fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                                          :fieldRequired="($field->required === 'yes') ? true : false"
                                          :fieldPlaceholder="$field->label"
                                          :fieldValue="$model->custom_fields_data['field_'.$field->id] ?? ''">
                        </x-forms.textarea>

                    @elseif($field->type == 'radio')
                        <div class="form-group my-3">
                            <x-forms.label
                                fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                                :fieldLabel="$field->label"
                                :fieldRequired="($field->required === 'yes') ? true : false">
                            </x-forms.label>
                            <div class="d-flex flex-wrap">
                                <input type="hidden" name="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                                       id="{{$field->field_name.'_'.$field->id}}"/>
                                @php
                                    $hasOtherOption = false;
                                    $fieldValues = $allFieldValues[$field->id] ?? [];
                                    $otherValue = '';
                                    
                                    foreach ($fieldValues as $value) {
                                        if (strtolower($value) === 'other') {
                                            $hasOtherOption = true;
                                            break;
                                        }
                                    }
                                @endphp
                                 @php
                                    $selectedValue = $model->custom_fields_data['field_' . $field->id] ?? '';
                                    
                                    // Extract other value if selected value contains "other: "
                                    if ($selectedValue && strpos($selectedValue, 'other: ') === 0) {
                                        $otherValue = substr($selectedValue, 7);
                                    }
                                @endphp
                                
                                @foreach ($fieldValues as $key => $value)
                                    <x-forms.radio
                                        fieldId="optionsRadios{{ $key . $field->id }}"
                                        :fieldLabel="$value"
                                        fieldName="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                                        :fieldValue="$value"
                                        :checked="($selectedValue == $value) ? true : false"
                                        :fieldRequired="($field->required === 'yes') ? true : false"
                                        onchange="CustomFieldHandlers.handleRadioChange('{{ e($field->field_name.'_'.$field->id) }}', '{{ e($value) }}', '{{ $hasOtherOption ? 'true' : 'false' }}', '{{ e($field->id) }}')"
                                        />
                                @endforeach
                            </div>
                            
                            @if($hasOtherOption)
                                <div id="other_text_{{ $field->id }}" class="mt-2" style="display: {{ (strtolower($selectedValue) == 'other' || strpos(strtolower($selectedValue), 'other: ') === 0) ? 'block' : 'none' }};">
                                    <input type="text" 
                                           class="form-control height-35 f-14" 
                                           placeholder="Please specify..."
                                           id="other_input_{{ $field->id }}"
                                           value="{{ $otherValue }}"
                                           onchange="CustomFieldHandlers.updateOtherValue('{{$field->field_name.'_'.$field->id}}', '{{$field->id}}')">
                                </div>
                            @endif
                        </div>

                    @elseif($field->type == 'select')
                        <div class="form-group my-3">
                            <x-forms.label
                                fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                                :fieldLabel="$field->label"
                                :fieldRequired="($field->required === 'yes') ? true : false">
                            </x-forms.label>
                            @php
                                $hasOtherOption = false;
                                $fieldValues = $allFieldValues[$field->id] ?? [];
                                $otherValue = '';
                                $selectedValue = $model ? $model->custom_fields_data['field_' . $field->id] : '';
                                
                                foreach ($fieldValues as $value) {
                                    if (strtolower($value) === 'other') {
                                        $hasOtherOption = true;
                                        break;
                                    }
                                }
                                
                                // Extract other value if selected value contains "other: "
                                if ($selectedValue && strpos($selectedValue, 'other: ') === 0) {
                                    $otherValue = substr($selectedValue, 7);
                                }
                            @endphp
                            
                            <select class="form-control select-picker" name="custom_fields_data[{{ $field->name . '_' . $field->id }}]" id="custom_fields_data[{{ $field->name . '_' . $field->id }}]" onchange="CustomFieldHandlers.handleSelectChange('{{$field->name.'_'.$field->id}}', '{{$field->id}}', '{{ $hasOtherOption ? 'true' : 'false' }}')">
                                <option value="">--</option>
                                @foreach ($fieldValues as $value)
                                    <option value="{{ $value }}" {{ $selectedValue == $value ? 'selected' : '' }}>
                                        {{ $value }}
                                    </option>
                                @endforeach
                            </select>
                            
                            @if($hasOtherOption)
                                <div id="other_text_select_{{ $field->id }}" class="mt-2" style="display: {{ (strtolower($selectedValue) == 'other' || strpos(strtolower($selectedValue), 'other: ') === 0) ? 'block' : 'none' }};">
                                    <input type="text" 
                                           class="form-control height-35 f-14" 
                                           placeholder="Please specify..."
                                           id="other_input_select_{{ $field->id }}"
                                           value="{{ $otherValue }}"
                                           onchange="CustomFieldHandlers.updateOtherSelectValue('{{$field->name.'_'.$field->id}}', '{{$field->id}}')">
                                </div>
                            @endif
                        </div>

                    @elseif($field->type == 'date')
                        <x-forms.datepicker custom="true"
                                            fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                                            :fieldRequired="($field->required === 'yes') ? true : false"
                                            :fieldLabel="$field->label"
                                            fieldName="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                                            :fieldValue="($model && $model->custom_fields_data['field_'.$field->id] != '') ? \Carbon\Carbon::parse($model->custom_fields_data['field_'.$field->id])->format(company()->date_format) : now()->format(company()->date_format)"
                                            :fieldPlaceholder="$field->label"/>

                  

                    @elseif($field->type == 'checkbox')
                        <x-forms.label
                            fieldId="custom_fields_data[{{ $field->field_name . '_' . $field->id }}]"
                            :fieldLabel="$field->label"
                            :fieldRequired="($field->required === 'yes') ? true : false">
                        </x-forms.label>
                        <div class="d-flex flex-wrap checkbox{{$field->id}}">
                            @php
                                $checkedValues = '';
                                $selectedValues = [];
                                $hasOtherOption = false;
                                $otherValue = '';

                                if ($model && isset($model->custom_fields_data['field_'.$field->id]) && $model->custom_fields_data['field_'.$field->id] != '') {
                                    $selectedValues = explode(', ', $model->custom_fields_data['field_'.$field->id]);
                                }

                                $fieldValues = $allFieldValues[$field->id] ?? [];
                                
                                foreach ($fieldValues as $value) {
                                    if (strtolower($value) === 'other') {
                                        $hasOtherOption = true;
                                        break;
                                    }
                                }
                                
                                $otherSelectedValues = [];
                                foreach ($selectedValues as $value) {
                                    if (strpos($value, 'other: ') === 0) {
                                        $otherValue = substr($value, 7);
                                        $otherSelectedValues[] = 'other';
                                    } else {
                                        $otherSelectedValues[] = $value;
                                    }
                                }

                                foreach ($fieldValues as $key => $value) {
                                    if (in_array($value, $otherSelectedValues)) {
                                        $checkedValues .= ($checkedValues == '') ? $value : ', '.$value;
                                    }
                                }
                                
                                if (!is_array($fieldValues)) {
                                    $fieldValues = [];
                                }
                            @endphp

                            <input type="hidden"
                                   name="custom_fields_data[{{$field->field_name.'_'.$field->id}}]"
                                   id="{{$field->field_name.'_'.$field->id}}"
                                   value="{{ $checkedValues }}">

                            @foreach ($fieldValues as $key => $value)
                                <div class="col-6 p-0">
                                    <x-forms.checkbox
                                        fieldId="checkbox{{ $key . $field->id }}"
                                        :fieldLabel="$value"
                                        :fieldName="$field->field_name.'_'.$field->id.'[]'"
                                        :fieldValue="$value"
                                        :checked="in_array($value, $otherSelectedValues)"
                                        onchange="CustomFieldHandlers.checkboxMsChange('checkbox{{ e($field->id) }}', '{{ e($field->field_name.'_'.$field->id) }}', '{{ $hasOtherOption ? 'true' : 'false' }}', '{{ e($field->id) }}')"
                                        :fieldRequired="($field->required === 'yes') ? true : false"/>
                                </div>
                            @endforeach
                        </div>
                        
                        @if($hasOtherOption)
                            <div id="other_text_checkbox_{{ $field->id }}" class="mt-2" style="display: {{ (in_array('other', array_map('strtolower', $otherSelectedValues))) ? 'block' : 'none' }};">
                                <input type="text" 
                                       class="form-control height-35 f-14" 
                                       placeholder="Please specify..."
                                       id="other_input_checkbox_{{ $field->id }}"
                                       value="{{ $otherValue }}"
                                       onchange="CustomFieldHandlers.updateOtherCheckboxValue('{{$field->field_name.'_'.$field->id}}', '{{$field->id}}')">
                            </div>
                        @endif

                    @elseif($field->type == 'country')
                        <x-forms.country
                            :fieldLabel="$field->label"
                            :fieldPlaceholder="$field->label"
                            :fieldName="'custom_fields_data[' . $field->name . '_' . $field->id . ']'"
                            fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldRequired="($field->required === 'yes') ? true : false"
                            :fieldValue="$model->custom_fields_data['field_'.$field->id] ?? ''">
                        </x-forms.country>
                    @elseif($field->type == 'phone')
                        <x-forms.phone
                            :fieldLabel="$field->label"
                            :fieldPlaceholder="$field->label"
                            :fieldName="'custom_fields_data[' . $field->name . '_' . $field->id . ']'"
                            fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldRequired="($field->required === 'yes') ? true : false"
                            :fieldValue="$model->custom_fields_data['field_'.$field->id] ?? ''">
                        </x-forms.phone>
                    @elseif($field->type == 'currency')
                        <x-forms.currency
                            :fieldLabel="$field->label"
                            :fieldPlaceholder="$field->label"
                            :fieldName="'custom_fields_data[' . $field->name . '_' . $field->id . ']'"
                            fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldRequired="($field->required === 'yes') ? true : false"
                            :fieldValue="$model->custom_fields_data['field_'.$field->id] ?? ''">
                        </x-forms.currency>
                    @elseif ($field->type == 'file')
                        <input type="hidden" name="custom_fields_data[{{$field->name.'_'.$field->id}}]"
                               value="{{ $model ? $model->custom_fields_data['field_'.$field->id]:''}}">
                        <x-forms.file
                            class="custom-field-file"
                            :fieldLabel="$field->label"
                            :fieldRequired="($field->required === 'yes') ? true : false"
                            :fieldName="'custom_fields_data[' . $field->name . '_' . $field->id . ']'"
                            :fieldId="'custom_fields_data[' . $field->name . '_' . $field->id . ']'"
                            :fieldValue="$model ? ($model->custom_fields_data['field_' . $field->id] != '' ? asset_url_local_s3('custom_fields/' .$model->custom_fields_data['field_' . $field->id]) : '') : ''"
                        />
                    @endif

                    <div class="form-control-focus"></div>
                    <span class="help-block"></span>
                </div>
            </div>
        @endforeach
    </div>
@endif

<script>

window.CustomFieldHandlers = {
    checkboxMsChange: function(containerClass, hiddenInputId, hasOtherOption, fieldId) {
        var checkedValues = [];
        $('.' + containerClass + ' input[type="checkbox"]:checked').each(function() {
            checkedValues.push($(this).val());
        });
        $('#' + hiddenInputId).val(checkedValues.join(', '));

        if (hasOtherOption) {
            var otherInput = $('#other_input_checkbox_' + fieldId);
            var otherTextDiv = $('#other_text_checkbox_' + fieldId);

            if (checkedValues.some(function(val) { return val.toLowerCase() === 'other'; })) {
                otherTextDiv.show();
            } else {
                otherTextDiv.hide();
                otherInput.val(''); 
            }
        }
    },

    handleRadioChange: function(hiddenInputId, selectedValue, hasOtherOption, fieldId) {
        var otherTextDiv = $('#other_text_' + fieldId);
        var otherInput = $('#other_input_' + fieldId);

        if (hasOtherOption && selectedValue.toLowerCase() === 'other') {
            otherTextDiv.show();
            otherInput.focus();
        } else {
            otherTextDiv.hide();
            otherInput.val(''); 
        }
    },

    updateOtherValue: function(fieldName, fieldId) {
        var otherInput = $('#other_input_' + fieldId);
        var otherValue = otherInput.val().trim();
        
        if (otherValue !== '') {
            $('#' + fieldName).val('other: ' + otherValue);
        } else {
            $('#' + fieldName).val('other');
        }
    },

    updateOtherCheckboxValue: function(fieldName, fieldId) {
        var otherInput = $('#other_input_checkbox_' + fieldId);
        var otherValue = otherInput.val().trim();
        var hiddenInput = $('#' + fieldName);
        var currentValues = hiddenInput.val().split(', ');
        
        currentValues = currentValues.filter(function(value) {
            return value.toLowerCase().indexOf('other: ') !== 0;
        }).map(function(value) {
            return value.replace(/[<>"'&]/g, function(match) {
                return {'<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;'}[match];
            });
        });
        
        if (currentValues.some(function(val) { return val.toLowerCase() === 'other'; })) {
            if (otherValue !== '') {
                currentValues.push('other: ' + otherValue);
            } else {
                currentValues.push('other');
            }
        }
        
        hiddenInput.val(currentValues.join(', '));
    },

    handleSelectChange: function(fieldName, fieldId, hasOtherOption) {
        var selectElement = $('select[name="custom_fields_data[' + fieldName + ']"]');
        var selectedValue = selectElement.val();
        var otherTextDiv = $('#other_text_select_' + fieldId);
        var otherInput = $('#other_input_select_' + fieldId);

        if (hasOtherOption === 'true' && selectedValue.toLowerCase() === 'other') {
            otherTextDiv.show();
            otherInput.focus();
        } else {
            otherTextDiv.hide();
            otherInput.val(''); 
        }
    },

    updateOtherSelectValue: function(fieldName, fieldId) {
        var otherInput = $('#other_input_select_' + fieldId);
        var otherValue = otherInput.val().trim();
        var selectElement = $('select[name="custom_fields_data[' + fieldName + ']"]');
        
        if (otherValue !== '') {
            selectElement.val('other: ' + otherValue);
        } else {
            selectElement.val('other');
        }
    },

    updateCurrencyValue: function(fieldName, fieldId) {
        var currencySelect = $('#currency_' + fieldId);
        var amountInput = $('input[name="' + fieldName + '"]');
        var selectedCurrency = currencySelect.find(':selected');
        var currencyCode = selectedCurrency.text().trim();
        var amountValue = amountInput.val().trim();
        
        if (currencyCode && amountValue !== '') {
            var currencyData = {
                currency_code: currencyCode,
                amount: amountValue
            };
            $('#' + fieldName).val(JSON.stringify(currencyData));
        }
    }
};

$(document).ready(function() {
    $('[id^="country_phonecode_"]').on('change', function() {
        var fieldId = $(this).attr('id').replace('country_phonecode_', '');
        var selectedPhoneCode = $(this).val();
        var phoneInput = $('input[name="custom_fields_data[field_' + fieldId + ']"]');
        var phoneNumber = phoneInput.val();
        
         if (phoneNumber) {
            phoneInput.data('country-code', selectedPhoneCode);
        }
    });
    
  
    $('[id^="country_phonecode_"]').selectpicker();
    
    $('select[name*="custom_fields_data"][name*="currency"]').selectpicker();
    
    // Initialize select dropdowns with "other" functionality
    $('select[name*="custom_fields_data"]').each(function() {
        var selectElement = $(this);
        var fieldName = selectElement.attr('name').match(/custom_fields_data\[([^\]]+)\]/)[1];
        var fieldId = fieldName.split('_').pop();
        var selectedValue = selectElement.val();
        
        // Check if this select has "other" option and show/hide text input accordingly
        if (selectedValue && selectedValue.toLowerCase() === 'other') {
            $('#other_text_select_' + fieldId).show();
        }
    });
    
    $('select[id^="currency_"]').on('change', function() {
        var fieldId = $(this).attr('id').replace('currency_', '');
        var selectedCurrency = $(this).find(':selected');
        var currencySymbol = selectedCurrency.data('currency-symbol');
        var amountInput = $('input[name="custom_fields_data[field_' + fieldId + ']"]');
        
        // Update placeholder with currency symbol
        if (currencySymbol) {
            amountInput.attr('placeholder', currencySymbol + ' 0.00');
        }
    });
    
    $('select[id^="currency_"]').each(function() {
        var fieldId = $(this).attr('id').replace('currency_', '');
        var selectedCurrency = $(this).find(':selected');
        var currencySymbol = selectedCurrency.data('currency-symbol');
        var amountInput = $('input[name="custom_fields_data[field_' + fieldId + ']"]');
        
        if (currencySymbol) {
            amountInput.attr('placeholder', currencySymbol + ' 0.00');
        }
    });
});
</script>
