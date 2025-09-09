<div class="col-md-4">
    <x-forms.text fieldId="name" :fieldLabel="__('app.name')" fieldName="name" :fieldValue="$formFields['name'] ?? ''" />
</div>
<div class="col-md-4">
    <x-forms.text fieldId="upi" :fieldLabel="__('qrcode::app.fields.upiId')" fieldName="upi" fieldRequired="true" :fieldValue="$formFields['upi'] ?? ''"></x-forms.text>
</div>
<div class="col-md-4">
    <x-forms.number fieldId="amount" :fieldLabel="__('qrcode::app.fields.amount')" fieldName="amount" :fieldValue="$formFields['amount'] ?? ''" :fieldHelp="__('qrcode::app.fields.upiAmountHelp')"/>
</div>
<div class="col-md-12">
    <x-forms.textarea class="mr-0 mr-lg-2 mr-md-2"
                      :fieldLabel="__('app.note')" fieldName="description"
                      fieldId="description" :fieldValue="$formFields['description'] ?? ''">
    </x-forms.textarea>
</div>
