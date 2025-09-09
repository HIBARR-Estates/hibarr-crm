<div class="col-md-6">
    <x-forms.text :fieldLabel="__('qrcode::app.fields.username')" :fieldRequired="true" fieldName="username" fieldId="username" :fieldValue="$formFields['username'] ?? ''"/>
</div>
<div class="col-md-6">
    <div class="form-group my-3">
        <label class="f-14 text-dark-grey mb-0 w-100 mt-3" for="usr">@lang('qrcode::app.fields.skypeContactType')<sup
                class="f-14 mr-1">*</sup></label>
        <div class="d-flex">
            <x-forms.radio fieldId="notification-chat" :fieldLabel="__('qrcode::app.fields.chat')" fieldValue="chat" fieldName="skypeContactType"
                :checked="($formFields['skypeContactType'] ?? 'chat') == 'chat'">
            </x-forms.radio>
            <x-forms.radio fieldId="notification-call" :fieldLabel="__('qrcode::app.fields.call')" fieldValue="call" fieldName="skypeContactType" :checked="($formFields['skypeContactType'] ?? '') == 'call'">
            </x-forms.radio>
        </div>
    </div>
</div>
