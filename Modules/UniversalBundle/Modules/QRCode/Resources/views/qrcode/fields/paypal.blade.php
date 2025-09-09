<div class="col-md-6">
    <x-forms.select fieldId="paymentType" :fieldLabel="__('qrcode::app.fields.paypalPaymentType')" fieldName="paymentType"  fieldRequired="true">
            <option @selected('_xclick' == ($formFields['paymentType'] ?? '')) value="_xclick">@lang('qrcode::app.fields.buyNow')</option>
            <option @selected('_cart' == ($formFields['paymentType'] ?? '')) value="_cart">@lang('qrcode::app.fields.addCart')</option>
            <option @selected('_donations' == ($formFields['paymentType'] ?? '')) value="_donations">@lang('qrcode::app.fields.donate')</option>
    </x-forms.select>
</div>
<div class="col-md-6">
    <x-forms.select fieldId="currency" :fieldLabel="__('qrcode::app.fields.currency')" fieldName="currency" search="true" fieldRequired="true">
        @foreach ($currencies as $currency)
            <option @selected(($formFields['currency'] ?? '') == $currency->currency_code) value="{{ $currency->currency_code }}">
                {{ $currency->currency_symbol . ' (' . $currency->currency_code . ')' }}
            </option>
        @endforeach
    </x-forms.select>
</div>
<div class="col-md-8">
    <x-forms.text fieldId="itemName" :fieldLabel="__('qrcode::app.fields.itemName')" fieldName="itemName" fieldRequired="true" :fieldValue="$formFields['itemName'] ?? ''"/>
</div>
<div class="col-md-4">
    <x-forms.text fieldId="itemId" :fieldLabel="__('qrcode::app.fields.itemId')" fieldName="itemId" :fieldValue="$formFields['itemId'] ?? ''"/>
</div>
<div class="col-md-6">
    <x-forms.email fieldId="email" :fieldLabel="__('app.email')"  fieldRequired="true" fieldName="email" :fieldPlaceholder="__('placeholders.email')" :fieldHelp="__('qrcode::app.fields.paypalEmailHelp')" :fieldValue="$formFields['email'] ?? ''"/>
</div>
<div class="col-md-6">
    <x-forms.number fieldId="amount" :fieldLabel="__('qrcode::app.fields.amount')" fieldName="amount" :fieldValue="$formFields['amount'] ?? ''"></x-forms.number>
</div>
<div class="col-md-6">
    <x-forms.number fieldId="shipping" :fieldLabel="__('qrcode::app.fields.shipping')" fieldName="shipping" :fieldValue="$formFields['shipping'] ?? ''"></x-forms.number>
</div>
<div class="col-md-6">
    <x-forms.label class="mt-3" fieldId="tax" :fieldLabel="__('app.tax')">
    </x-forms.label>
    <x-forms.input-group>
        <input type="number" name="tax" id="tax" class="form-control height-35 f-14" value="{{ $formFields['tax'] ?? '' }}">
        <x-slot name="preappend">
            <label class="input-group-text border-grey bg-white height-35">%</label>
        </x-slot>
    </x-forms.input-group>
</div>
