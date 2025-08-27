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
             @php
                // Generate unique field names to avoid conflicts
                $countryCodeFieldName = 'country_phonecode_' . $fieldId;
                $countryCodeFieldId = 'country_phonecode_' . $fieldId;
                
                $countries = Cache::remember('countries_list', 3600, function () {
                    return \App\Models\Country::all();
                });

                $phoneValue = $fieldValue ?? '';
                $countryCode = '';
                $phoneNumber = '';

                // Parse existing phone number to extract country code and phone number
                if (!empty($phoneValue)) {
                    // First, try to decode as JSON (new format with identifiers)
                    $decoded = json_decode($phoneValue, true);
                    if (json_last_error() === JSON_ERROR_NONE && isset($decoded['country_code'])) {
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
                        } 
                        // Try to match without space: +[country_code][phone_number]
                        elseif (preg_match('/^\+(\d{1,4})(.*)$/', $phoneValue, $matches)) {
                            $countryCode = $matches[1];
                            $phoneNumber = $matches[2];
                        }
                        // If no country code found, use the full value as phone number
                        else {
                            $phoneNumber = $phoneValue;
                        }
                    }
                }
                
                // If no country code found from phone number, try to use the country parameter
                if (empty($countryCode) && !empty($country)) {
                    $countryModel = $countries->firstWhere('nicename', $country)
                        ?: $countries->firstWhere('iso', $country)
                        ?: $countries->firstWhere('iso3', $country);
                    if ($countryModel) {
                        $countryCode = $countryModel->phonecode;
                    }
                }
                
                // If still no country code, try to use the stored country identifier from JSON
                if (empty($countryCode) && !empty($phoneValue)) {
                    $decoded = json_decode($phoneValue, true);
                    if (json_last_error() === JSON_ERROR_NONE && isset($decoded['country_identifier'])) {
                        $storedCountry = $decoded['country_identifier'];
                        $countryModel = $countries->firstWhere('nicename', $storedCountry) 
                            ?: $countries->firstWhere('iso', $storedCountry)
                            ?: $countries->firstWhere('iso3', $storedCountry);
                        if ($countryModel) {
                            $countryCode = $countryModel->phonecode;
                        }
                    }
                }
                
                
            @endphp
                         <select class="form-control select-picker country-code-select" id="{{ $countryCodeFieldId }}"
                 name="{{ $countryCodeFieldName }}" data-live-search="true">
                <option value="">--</option>
                @foreach ($countries as $item)
                    <option data-tokens="{{ $item->name }}" data-country-iso="{{ $item->iso }}"
                        data-content="{{ $item->flagSpanCountryCode() }}" value="{{ $item->phonecode }}"
                        {{ $countryCode == $item->phonecode ? 'selected' : '' }}>
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
                 $decoded = json_decode($phoneValue, true);
                 if (json_last_error() === JSON_ERROR_NONE && isset($decoded['country_identifier'])) {
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
         $('#{{ $countryCodeFieldId }}').on('change', function() {
             var selectedCountryCode = $(this).val();
             var countryIdentifierField = $('#country_identifier_{{ $fieldId }}');
             
             if (selectedCountryCode) {
                 var selectedOption = $(this).find('option:selected');
                 var countryName = selectedOption.data('tokens') || selectedOption.text().trim();
                 countryIdentifierField.val(countryName);
             }
         });
     });
 </script>
