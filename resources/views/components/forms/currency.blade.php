<div {{ $attributes->merge(['class' => 'form-group my-3']) }}>
    <x-forms.label :fieldId="$fieldId" :fieldLabel="$fieldLabel" :fieldRequired="$fieldRequired"></x-forms.label>

    <div class="input-group">
        <div>
            <select class="form-control select-picker" id="currency_{{ $fieldId }}"
                name="currency_{{ $fieldId }}" data-live-search="true"
                style="max-width: 70px; min-width: 60px; width: 70px;">
                @php
                    $currencies = Cache::remember('currencies_list', 3600, function () {
                        return \App\Models\Currency::all();
                    });

                    $currencyValue = $fieldValue ?? '';
                    $selectedCurrencyId = '';
                    $amountValue = '';

                    if (!empty($currencyValue)) {
                        $data = json_decode($currencyValue, true);
                        if ($data && isset($data['currency_code']) && isset($data['amount'])) {
                            $currencyCode = $data['currency_code'];
                            $amountValue = $data['amount'];

                            $currency = $currencies->where('currency_code', $currencyCode)->first();
                            if ($currency) {
                                $selectedCurrencyId = $currency->id;
                            }
                        }
                    }
                @endphp
                @foreach ($currencies as $currency)
                    <option data-tokens="{{ $currency->currency_code }} {{ $currency->currency_name }}"
                        data-currency-symbol="{{ $currency->currency_symbol }}" value="{{ $currency->id }}"
                        {{ $selectedCurrencyId == $currency->id ? 'selected' : '' }}>
                        {{ $currency->currency_code }}
                    </option>
                @endforeach
            </select>
        </div>
        <input type="number" class="form-control height-35 f-14" placeholder="0.00" name="{{ $fieldName }}"
            id="{{ $fieldId }}" value="{{ $amountValue }}" step="0.01" min="0"
            style="flex: 1; min-width: 0;">
    </div>
</div>
