@props(['fieldId', 'fieldLabel', 'fieldName', 'fieldRequired' => false, 'fieldValue' => '', 'country' => null])

<style>
    .phone-component .input-group {
        display: flex;
        align-items: stretch;
        width: 100%;
        position: relative;
    }

    .phone-component .input-group > div {
        display: flex;
        align-items: stretch;
    }
    
    .phone-component .country-code-select {
        min-width: 87px;
        flex-shrink: 0;
        border-top-right-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
        border-right: none !important;
        height: 35px !important;
       
    }
    
    .phone-component .phone-input {
        flex: 1;
        min-width: 200px;
        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;
        border-left: none !important;
        
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
                <option value="">--</option>
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
                        if (is_array($decoded)) {
                            if (isset($decoded['country_code'])) {
                                // New format: JSON with country code and identifier
                                $countryCode = $decoded['country_code'];
                                $phoneNumber = $decoded['phone'] ?? '';
                            } else {
                                // Array payload without country_code; try common keys
                                $candidate = $decoded['phone'] ?? $decoded['mobile'] ?? $decoded['number'] ?? null;
                                if (is_string($candidate)) {
                                    $phoneNumber = $candidate;
                                }
                            }
                        } elseif (is_string($phoneValue)) {
                            // Old format: simple string, try to parse international format
                            $raw = $phoneValue;
                            if (preg_match('/^\+(\d{1,4})\s*(.*)$/', $raw, $matches)) {
                                $countryCode = $matches[1];
                                $phoneNumber = $matches[2];
                            } else {
                                $phoneNumber = $raw;
                            }
                        }
                        // If phone contains a prefixed country code, strip it out
                        if (is_string($phoneNumber) && preg_match('/^\+(\d{1,4})\s*(.*)$/', $phoneNumber, $matches)) {
                            $countryCode = $countryCode ?: $matches[1];
                            $phoneNumber = $matches[2];
                        }
                    }
                @endphp
                @php
                    // Determine which country option should be selected
                    $selectedCountry = null;
                    
                    // First priority: Use the stored country identifier if available
                    if (!empty($phoneValue)) {
                        $decoded = is_array($phoneValue) ? $phoneValue : json_decode($phoneValue, true);
                        if (is_array($decoded) && isset($decoded['country_identifier'])) {
                            $storedIdentifier = $decoded['country_identifier'];
                            $selectedCountry = $countries->firstWhere('nicename', $storedIdentifier);
                            if (!$selectedCountry) {
                                $selectedCountry = $countries->firstWhere('iso', $storedIdentifier);
                            }
                            if (!$selectedCountry) {
                                $selectedCountry = $countries->firstWhere('iso3', $storedIdentifier);
                            }
                        }
                    }
                    
                                         // Second priority: Use the country parameter if no stored identifier
                     if (!$selectedCountry && !empty($country)) {
                         $selectedCountry = $countries->firstWhere('nicename', $country);
                         if (!$selectedCountry) {
                             $selectedCountry = $countries->firstWhere('iso', $country);
                         }
                         if (!$selectedCountry) {
                             $selectedCountry = $countries->firstWhere('iso3', $country);
                         }
                         if (!$selectedCountry) {
                             // Try to find by country name (like "TURKEY")
                             $selectedCountry = $countries->firstWhere('name', $country);
                         }
                     }
                    
                    // Third priority: Use country code if no other identifier found
                    if (!$selectedCountry && !empty($countryCode)) {
                        $selectedCountry = $countries->firstWhere('phonecode', $countryCode);
                    }
                    
                    // Debug: Log what we found for troubleshooting
                    if (app()->environment('local')) {
                        \Log::info('Phone component country selection:', [
                            'fieldId' => $fieldId,
                            'phoneValue' => $phoneValue,
                            'countryCode' => $countryCode,
                            'storedIdentifier' => $storedIdentifier ?? 'none',
                            'selectedCountry' => $selectedCountry ? $selectedCountry->nicename . ' (' . $selectedCountry->phonecode . ')' : 'none'
                        ]);
                    }
                @endphp
                
                @foreach ($countries as $item)
                    <option data-tokens="{{ $item->name }}" data-country-iso="{{ $item->iso }}"
                        data-country-nicename="{{ $item->nicename }}" data-content="{{ $item->flagSpanCountryCode() }}" 
                        value="{{ $item->phonecode }}" {{ $selectedCountry && $selectedCountry->id == $item->id ? 'selected' : '' }}>
                        {{ $item->phonecode }}
                    </option>
                @endforeach
            </select>
        </div>
        <input type="tel" class="form-control height-35 f-14 phone-input" placeholder="@lang('placeholders.mobile')"
            name="{{ $fieldName }}" id="{{ $fieldId }}" value="{{ $phoneNumber }}">
        
                 @php
             // Use the selected country's nicename for the identifier
             $countryIdentifier = $selectedCountry ? $selectedCountry->nicename : '';
             
             // If we still don't have an identifier but have a country parameter, try to derive it
             if (empty($countryIdentifier) && !empty($country)) {
                 $countryModel = $countries->firstWhere('nicename', $country);
                 if (!$countryModel) {
                     $countryModel = $countries->firstWhere('iso', $country);
                 }
                 if (!$countryModel) {
                     $countryModel = $countries->firstWhere('iso3', $country);
                 }
                 if (!$countryModel) {
                     $countryModel = $countries->firstWhere('name', $country);
                 }
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

        // Ensure phone input only accepts numbers
        $('[id="{{ $fieldId }}"]').on('input', function() {
            // Remove any non-numeric characters
            var value = $(this).val().replace(/[^0-9]/g, '');
            $(this).val(value);
        });

        // Prevent non-numeric characters while allowing navigation keys
        $('[id="{{ $fieldId }}"]').on('keydown', function(e) {
            // Allow: backspace, delete, tab, escape, enter, home, end, arrows
            if ([8, 9, 27, 13, 46, 35, 36, 37, 38, 39, 40].indexOf(e.keyCode) !== -1 ||
                // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                (e.keyCode === 65 && e.ctrlKey === true) ||
                (e.keyCode === 67 && e.ctrlKey === true) ||
                (e.keyCode === 86 && e.ctrlKey === true) ||
                (e.keyCode === 88 && e.ctrlKey === true)) {
                return;
            }
            // Ensure that it is a number and stop the keypress
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }
        });

        // Handle paste events to clean pasted content
        $('[id="{{ $fieldId }}"]').on('paste', function(e) {
            setTimeout(function() {
                var $el = $('[id="{{ $fieldId }}"]');
                var value = $el.val().replace(/[^0-9]/g, '');
                $el.val(value);
            }, 10);
        });
    });
</script>
