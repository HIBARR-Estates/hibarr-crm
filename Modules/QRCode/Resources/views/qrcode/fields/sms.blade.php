<div class="col-md-12">
    <x-forms.label class="my-3" fieldId="mobile" :fieldLabel="__('app.mobile')" fieldRequired="true"/>
    <x-forms.input-group style="margin-top:-4px">

        <x-forms.select fieldId="country_phonecode" fieldName="country_phonecode" class="w-25" search="true">
            @foreach (countries() as $item)
                <option data-tokens="{{ $item->name }}" data-content="{{ $item->flagSpanCountryCode() }}"
                    @selected($item->phonecode == ($formFields['country_phonecode'] ?? '')) value="{{ $item->phonecode }}">{{ $item->phonecode }}
                </option>
            @endforeach
        </x-forms.select>
        <input type="tel" class="form-control height-35 f-14" placeholder="@lang('placeholders.mobile')" name="mobile" value="{{ $formFields['mobile'] ?? '' }}"
            id="mobile">
    </x-forms.input-group>
</div>
<div class="col-md-12">
    <x-forms.textarea class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('qrcode::app.fields.message')" fieldName="message" fieldId="message" :fieldValue="$formFields['message'] ?? ''">
    </x-forms.textarea>
</div>
