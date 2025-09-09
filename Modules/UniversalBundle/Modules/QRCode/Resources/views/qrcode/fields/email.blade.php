<div class="col-md-6">
    <x-forms.email fieldId="email" :fieldLabel="__('app.email')" fieldName="email" :fieldPlaceholder="__('placeholders.email')" :fieldRequired="true" :fieldValue="$formFields['email'] ?? ''" />
</div>
<div class="col-md-6">
    <x-forms.text :fieldLabel="__('qrcode::app.fields.subject')" fieldName="subject" fieldId="subject" :fieldValue="$formFields['subject'] ?? ''"/>
</div>
<div class="col-md-12">
    <x-forms.textarea class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('qrcode::app.fields.message')" fieldName="message" fieldId="message" :fieldValue="$formFields['message'] ?? ''" />
</div>
