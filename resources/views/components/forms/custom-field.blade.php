<style>
    .invalid-feedback {
        display: contents;
    }
</style>
@props(['fields', 'model' => null, 'categoryId' => null])
@if (isset($fields) && count($fields) > 0)
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
                                    $otherValue = '';
                                    $selectedValue = $model ? $model->custom_fields_data['field_'.$field->id] : '';
                                    
                                    if (!is_null($selectedValue) && strpos($selectedValue, 'other: ') === 0) {
                                        $otherValue = substr($selectedValue, 7);
                                        $selectedValue = 'other';
                                    }
                                    
                                    $fieldValues = is_string($field->values) ? json_decode($field->values) : $field->values;
                                    
                                    foreach ($fieldValues as $value) {
                                        if (strtolower($value) === 'other') {
                                            $hasOtherOption = true;
                                            break;
                                        }
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
                                        onchange="handleRadioChange('{{ e($field->field_name.'_'.$field->id) }}', '{{ e($value) }}', '{{ $hasOtherOption ? 'true' : 'false' }}', '{{ e($field->id) }}')"
                                        />
                                @endforeach
                            </div>
                            
                            @if($hasOtherOption)
                                <div id="other_text_{{ $field->id }}" class="mt-2" style="display: {{ ($selectedValue == 'other') ? 'block' : 'none' }};">
                                    <input type="text" 
                                           class="form-control height-35 f-14" 
                                           placeholder="Please specify..."
                                           id="other_input_{{ $field->id }}"
                                           value="{{ $otherValue }}"
                                           onchange="updateOtherValue('{{$field->field_name.'_'.$field->id}}', '{{$field->id}}')">
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
                            {!! Form::select('custom_fields_data[' . $field->name . '_' . $field->id . ']', $field->values, $model ? $model->custom_fields_data['field_' . $field->id] : '', ['class' => 'form-control select-picker']) !!}
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

                                foreach (json_decode($field->values) as $value) {
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

                                foreach (json_decode($field->values) as $key => $value) {
                                    if (in_array($value, $otherSelectedValues)) {
                                        $checkedValues .= ($checkedValues == '') ? $value : ', '.$value;
                                    }
                                }
                                
                                $fieldValues = is_string($field->values) ? json_decode($field->values) : $field->values;
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
                                        onchange="checkboxMsChange('checkbox{{ e($field->id) }}', '{{ e($field->field_name.'_'.$field->id) }}', '{{ $hasOtherOption ? 'true' : 'false' }}', '{{ e($field->id) }}')"
                                        :fieldRequired="($field->required === 'yes') ? true : false"/>
                                </div>
                            @endforeach
                        </div>
                        
                        @if($hasOtherOption)
                            <div id="other_text_checkbox_{{ $field->id }}" class="mt-2" style="display: {{ (in_array('other', $otherSelectedValues)) ? 'block' : 'none' }};">
                                <input type="text" 
                                       class="form-control height-35 f-14" 
                                       placeholder="Please specify..."
                                       id="other_input_checkbox_{{ $field->id }}"
                                       value="{{ $otherValue }}"
                                       onchange="updateOtherCheckboxValue('{{$field->field_name.'_'.$field->id}}', '{{$field->id}}')">
                            </div>
                        @endif

                    @elseif($field->type == 'country')
                        <x-forms.select
                            fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldLabel="$field->label"
                            fieldName="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldRequired="($field->required === 'yes') ? true : false"
                            search="true">
                            <option value="">--</option>
                            @foreach (\App\Models\Country::all() as $item)
                                <option data-tokens="{{ $item->iso3 }}" data-phonecode="{{ $item->phonecode }}"
                                    data-iso="{{ $item->iso }}" 
                                    data-content="<span class='flag-icon flag-icon-{{ strtolower($item->iso) }} flag-icon-squared'></span> {{ $item->nicename }}"
                                    value="{{ $item->nicename }}" 
                                    {{ ($model->custom_fields_data['field_'.$field->id] ?? '') == $item->nicename ? 'selected' : '' }}>
                                    {{ $item->nicename }}
                                </option>
                            @endforeach
                        </x-forms.select>
                        
                    @elseif($field->type == 'phone')
                        @php
                            $countries = $countries ?? \App\Models\Country::all();                            $phoneValue = $model->custom_fields_data['field_'.$field->id] ?? '';
                            $currencyData = json_encode([
                                'currency_code' => 'USD',
                                'amount' => '100.50'
                            ]);
                            
                            if (!empty($phoneValue)) {
                                 if (preg_match('/^\+(\d{1,4})\s*(.*)$/', $phoneValue, $matches)) {
                                    $countryCode = $matches[1];
                                    $phoneNumber = $matches[2];
                                } else {
                                    $phoneNumber = $phoneValue;
                                }
                            }
                        @endphp
                        <x-forms.label class="my-3" fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldLabel="$field->label" :fieldRequired="($field->required === 'yes') ? true : false">
                        </x-forms.label>
                        <x-forms.input-group style="margin-top:-4px">
                            <x-forms.select fieldId="country_phonecode_{{ $field->id }}" fieldName="country_phonecode_{{ $field->id }}"
                                search="true">
                                @foreach (\App\Models\Country::all() as $item)
                                    <option data-tokens="{{ $item->name }}" data-country-iso="{{ $item->iso }}"
                                            data-content="{{$item->flagSpanCountryCode()}}"
                                            value="{{ $item->phonecode }}"
                                            {{ $countryCode == $item->phonecode ? 'selected' : '' }}>
                                        {{ $item->phonecode }}
                                    </option>
                                @endforeach
                            </x-forms.select>
                            <input type="tel" class="form-control height-35 f-14" 
                                placeholder="@lang('placeholders.mobile')"
                                name="custom_fields_data[{{ $field->name . '_' . $field->id }}]" 
                                id="custom_fields_data[{{ $field->name . '_' . $field->id }}]" 
                                value="{{ $phoneNumber }}">
                        </x-forms.input-group>

                    @elseif($field->type == 'currency')
                        @php
                            $currencyValue = $model->custom_fields_data['field_'.$field->id] ?? '';
                            $selectedCurrencyId = '';
                            $amountValue = '';
                            
                             
                            if (!empty($currencyValue)) {
                                $data = json_decode($currencyValue, true);
                                if ($data && isset($data['currency_code']) && isset($data['amount'])) {
                                    $currencyCode = $data['currency_code'];
                                    $amountValue = $data['amount'];
                                    
                                    $currency = \App\Models\Currency::where('currency_code', $currencyCode)->first();
                                    if ($currency) {
                                        $selectedCurrencyId = $currency->id;
                                    }
                                } 
                        @endphp
                        <x-forms.label class="my-3" fieldId="custom_fields_data[{{ $field->name . '_' . $field->id }}]"
                            :fieldLabel="$field->label" :fieldRequired="($field->required === 'yes') ? true : false">
                        </x-forms.label>
                        <x-forms.input-group style="margin-top:-4px">
                            <x-forms.select fieldId="currency_{{ $field->id }}" fieldName="currency_{{ $field->id }}"
                                search="true" onchange="updateCurrencyValue('{{$field->field_name.'_'.$field->id}}', '{{$field->id}}')">
                                @foreach (\App\Models\Currency::all() as $currency)
                                    <option data-tokens="{{ $currency->currency_code }} {{ $currency->currency_name }}"
                                            data-currency-symbol="{{ $currency->currency_symbol }}"
                                            value="{{ $currency->id }}"
                                            {{ $selectedCurrencyId == $currency->id ? 'selected' : '' }}>
                                        {{ $currency->currency_code }}
                                    </option>
                                @endforeach
                            </x-forms.select>
                            <input type="number" class="form-control height-35 f-14" 
                                placeholder="0.00"
                                name="custom_fields_data[{{ $field->name . '_' . $field->id }}]" 
                                id="custom_fields_data[{{ $field->name . '_' . $field->id }}]" 
                                value="{{ $amountValue }}"
                                step="0.01"
                                min="0"
                                onchange="updateCurrencyValue('{{$field->field_name.'_'.$field->id}}', '{{$field->id}}')">
                        </x-forms.input-group>

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

            if (checkedValues.includes('other')) {
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
            return value.indexOf('other: ') !== 0;
        }).map(function(value) {
            return value.replace(/[<>]/g, '');
        });
        
        if (currentValues.includes('other')) {
            if (otherValue !== '') {
                currentValues.push('other: ' + otherValue);
            } else {
                currentValues.push('other');
            }
        }
        
        hiddenInput.val(currentValues.join(', '));
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

  
window.checkboxMsChange = window.CustomFieldHandlers.checkboxMsChange;
window.handleRadioChange = window.CustomFieldHandlers.handleRadioChange;
window.updateOtherValue = window.CustomFieldHandlers.updateOtherValue;
window.updateOtherCheckboxValue = window.CustomFieldHandlers.updateOtherCheckboxValue;
window.updateCurrencyValue = window.CustomFieldHandlers.updateCurrencyValue;

$(document).ready(function() {
    $('[id^="country_phonecode_"]').on('change', function() {
        var fieldId = $(this).attr('id').replace('country_phonecode_', '');
        var selectedPhoneCode = $(this).val();
        
    });
    
  
    $('[id^="country_phonecode_"]').selectpicker();
    
    $('select[name*="custom_fields_data"][name*="currency"]').selectpicker();
    
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
