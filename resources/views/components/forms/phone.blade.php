@props(['fieldId', 'fieldLabel', 'fieldName', 'fieldRequired' => false, 'fieldValue' => '', 'country' => null])

<style>
    .phone-component .input-group {
        display: flex;
        align-items: stretch;
        width: 100%;
    }
    
    .phone-component .country-code-select {
        min-width: 120px;
        flex-shrink: 0;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
    }
    
    .phone-component .phone-input {
        flex: 1;
        min-width: 200px;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }
    
    .phone-component .country-code-select:focus + .phone-input,
    .phone-component .phone-input:focus {
        border-color: #80bdff;
        box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
    }
    
    @media (max-width: 768px) {
        .phone-component .input-group {
            flex-direction: column;
        }
        
        .phone-component .country-code-select,
        .phone-component .phone-input {
            min-width: 100%;
            border-radius: 4px;
        }
        
        .phone-component .country-code-select {
            margin-bottom: 8px;
        }
    }
</style>

<div {{ $attributes->merge(['class' => 'form-group my-3 phone-component']) }}>
    <x-forms.label :fieldId="$fieldId" :fieldLabel="$fieldLabel" :fieldRequired="$fieldRequired"></x-forms.label>

    <div class="input-group">
        <div>
            <select class="form-control select-picker country-code-select" id="country_phonecode_{{ $fieldId }}"
                name="country_phonecode_{{ $fieldId }}" data-live-search="true">
                @php
                    $countries = Cache::remember('countries_list', 3600, function () {
                        return \App\Models\Country::all();
                    });

                    $phoneValue = $fieldValue ?? '';
                    $countryCode = '';
                    $phoneNumber = '';

                                         if (!empty($phoneValue)) {
                         // Support both array-cast and JSON string payloads
                         $decoded = is_array($phoneValue) ? $phoneValue : json_decode($phoneValue, true);
                         if (is_array($decoded) && isset($decoded['country_code'])) {
                             // New format: JSON with country code and identifier
                             $countryCode = $decoded['country_code'];
                             $phoneNumber = $decoded['phone'] ?? '';
                             // Extract just the phone number part from the full phone string
                             if (preg_match('/^\+(\d{1,4})\s*(.*)$/', $phoneNumber, $matches)) {
                                 $phoneNumber = $matches[2];
                             }
                         } else {
                             // Old format: simple string, try to parse international format
                             if (preg_match('/^\+(\d{1,4})\s*(.*)$/', $phoneValue, $matches)) {
                                 $countryCode = $matches[1];
                                 $phoneNumber = $matches[2];
                             } else {
                                 $phoneNumber = $phoneValue;
                             }
                         }
                     }
                @endphp
                                 @foreach ($countries as $item)
                     <option data-tokens="{{ $item->name }}" data-country-iso="{{ $item->iso }}"
                         data-country-nicename="{{ $item->nicename }}" data-content="{{ $item->flagSpanCountryCode() }}" 
                         value="{{ $item->phonecode }}" {{ $countryCode == $item->phonecode ? 'selected' : '' }}>
                         {{ $item->phonecode }}
                     </option>
                 @endforeach
             </select>
         </div>
         <input type="tel" class="form-control height-35 f-14 phone-input" placeholder="@lang('placeholders.mobile')"
             name="{{ $fieldName }}" id="{{ $fieldId }}" value="{{ $phoneNumber }}">
         
         @php
             $countryIdentifier = '';
             if (!empty($country)) {
                 $countryIdentifier = $country;
             } elseif (!empty($phoneValue)) {
                 $decoded = is_array($phoneValue) ? $phoneValue : json_decode($phoneValue, true);
                 if (is_array($decoded) && isset($decoded['country_identifier'])) {
                     $countryIdentifier = $decoded['country_identifier'];
                 }
             } elseif (!empty($countryCode)) {
                 $countryModel = $countries->firstWhere('phonecode', $countryCode);
                 if ($countryModel) {
                     $countryIdentifier = $countryModel->nicename;
                 }
             }
         @endphp
         <input type="hidden" name="country_identifier_{{ $fieldId }}" value="{{ $countryIdentifier }}" id="country_identifier_{{ $fieldId }}">
     </div>
 </div>
 
 <script>
     // Auto-update country identifier when country code changes
     $(document).ready(function() {
         $('select[name="country_phonecode_{{ $fieldId }}"]').on('change', function() {
             var selectedOption = $(this).find('option:selected');
             var nicename = selectedOption.data('country-nicename');
             var iso = selectedOption.data('country-iso');
             var $idField = $('input[name="country_identifier_{{ $fieldId }}"]');
             $idField.val(nicename || iso || '');
         });
     });
 </script>
