<div {{ $attributes->merge(['class' => 'form-group my-3']) }} >
    <x-forms.label :fieldId="$fieldId" :fieldLabel="$fieldLabel" :fieldRequired="$fieldRequired"></x-forms.label>

    <select class="form-control select-picker" name="{{ $fieldName }}" id="{{ $fieldId }}" data-live-search="true">
        <option value="">--</option>
        @php
            $countries = Cache::remember('countries_list', 3600, function () {
                return \App\Models\Country::all();
            });
        @endphp
        @foreach ($countries as $item)
            <option data-tokens="{{ $item->iso3 }}" data-phonecode="{{ $item->phonecode }}"
                data-iso="{{ $item->iso }}" 
                data-content="<span class='flag-icon flag-icon-{{ strtolower($item->iso) }} flag-icon-squared'></span> {{ $item->nicename }}"
                value="{{ $item->nicename }}" 
                {{ $fieldValue == $item->nicename ? 'selected' : '' }}>
                {{ $item->nicename }}
            </option>
        @endforeach
    </select>
</div>
                        