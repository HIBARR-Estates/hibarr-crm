<div class="col-md-12">
    <div class="form-group my-3">
        <x-forms.label fieldId="url" :fieldLabel="__('qrcode::app.fields.meetingUrl')" :fieldRequired="true" />

        <input type="url" class="form-control height-35 f-14" placeholder="http://" name="url" id="url" value="{{ $formFields['url'] ?? '' }}">
    </div>

</div>
