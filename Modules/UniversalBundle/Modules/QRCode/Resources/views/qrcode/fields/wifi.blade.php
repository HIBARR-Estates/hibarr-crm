<div class="col-md-4">
    <x-forms.text fieldId="name" :fieldLabel="__('qrcode::app.fields.networkName')" fieldName="name" fieldRequired="true" :fieldValue="$formFields['name'] ?? ''"/>
</div>
<div class="col-md-4">
    <x-forms.label class="mt-3" fieldId="password" :fieldLabel="__('app.password')">
    </x-forms.label>
    <x-forms.input-group>
        <input type="password" name="password" id="password" class="form-control height-35 f-14" value="{{ $formFields['password'] ?? '' }}">
        <x-slot name="append">
            <button type="button" data-toggle="tooltip" data-original-title="@lang('app.viewPassword')"
                class="btn btn-outline-secondary border-grey height-35 toggle-password"><i
                    class="fa fa-eye"></i></button>
        </x-slot>
    </x-forms.input-group>
</div>
<div class="col-md-4">
    <x-forms.select fieldId="encryption" :fieldLabel="__('qrcode::app.fields.networkType')" fieldName="encryption">
        <option @selected('WEP' == ($formFields['encryption'] ?? '')) value="WEP">@lang('qrcode::app.fields.wep')</option>
        <option @selected('WPA' == ($formFields['encryption'] ?? '')) value="WPA">@lang('qrcode::app.fields.wpa')</option>
        <option @selected('' == ($formFields['encryption'] ?? '')) value="">@lang('qrcode::app.fields.noEncryption')</option>
    </x-forms.select>
</div>
<div class="col-md-4">
    <input type="hidden" name="hidden" value="0">
    <x-forms.checkbox fieldId="hidden" :fieldLabel="__('qrcode::app.fields.hidden')" fieldName="hidden" fieldValue="1" :checked="($formFields['hidden'] ?? false)"/>
</div>
