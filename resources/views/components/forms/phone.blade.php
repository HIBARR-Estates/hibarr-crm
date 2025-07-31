<div {{ $attributes->merge(['class' => 'form-group my-3']) }} >
    <x-forms.label :fieldId="$fieldId" :fieldLabel="$fieldLabel" :fieldRequired="$fieldRequired"></x-forms.label>

    <div class="input-group">
        <select class="form-control select-picker" id="country_phonecode_{{ $fieldId }}" name="country_phonecode_{{ $fieldId }}" data-live-search="true" style="max-width: 80px; min-width: 70px; width: 80px;">
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
                        data-content="{{$item->flagSpanCountryCode()}}"
                        value="{{ $item->phonecode }}"
                        {{ $countryCode == $item->phonecode ? 'selected' : '' }}>
                    {{ $item->phonecode }}
                </option>
            @endforeach
        </select>
        <input type="tel" class="form-control height-35 f-14" 
            placeholder="@lang('placeholders.mobile')"
            name="{{ $fieldName }}" 
            id="{{ $fieldId }}" 
            value="{{ $phoneNumber }}"
            style="flex: 1; min-width: 0;">
    </div>
</div>