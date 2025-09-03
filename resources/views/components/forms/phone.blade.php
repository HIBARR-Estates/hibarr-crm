<div {{ $attributes->merge(['class' => 'form-group my-3']) }}>
    <x-forms.label :fieldId="$fieldId" :fieldLabel="$fieldLabel" :fieldRequired="$fieldRequired"></x-forms.label>

    <div class="input-group">
        <div>
            <select class="form-control select-picker" id="country_phonecode_{{ $fieldId }}"
                name="country_phonecode_{{ $fieldId }}" data-live-search="true">
                @php
                    $countries = Cache::remember('countries_list', 3600, function () {
                        return \App\Models\Country::all();
                    });

                    $phoneValue = $fieldValue ?? '';
                    $countryCode = '';
                    $phoneNumber = '';

                    if (!empty($phoneValue)) {
                        if (preg_match('/^\+(\d{1,4})\s*(.*)$/', $phoneValue, $matches)) {
                            $countryCode = $matches[1];
                            $phoneNumber = $matches[2];
                        } else {
                            $phoneNumber = $phoneValue;
                        }
                    }
                @endphp
                @foreach ($countries as $item)
                    <option data-tokens="{{ $item->name }}" data-country-iso="{{ $item->iso }}"
                        data-content="{{ $item->flagSpanCountryCode() }}" value="{{ $item->phonecode }}"
                        {{ $countryCode == $item->phonecode ? 'selected' : '' }}>
                        {{ $item->phonecode }}
                    </option>
                @endforeach
            </select>
        </div>
        <input type="tel" class="form-control height-35 f-14" placeholder="@lang('placeholders.mobile')"
            name="{{ $fieldName }}" id="{{ $fieldId }}" value="{{ $phoneNumber }}"
            style="flex: 1; min-width: 0;">
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
