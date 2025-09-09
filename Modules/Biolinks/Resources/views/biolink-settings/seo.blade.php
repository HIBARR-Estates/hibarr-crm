<div class="row">
    <div class="col-md-12 mt-3 mb-3">
        <div class="form-group mb-lg-0 mb-md-0 mb-4">
            <x-forms.label fieldId="page_title" :fieldLabel="__('biolinks::app.pageTitle')">
            </x-forms.label>
            <div class="input-group">
                <input type="text" class="form-control height-35 f-15" name="page_title" id="page_title"
                    value="{{ $biolinkSettings->branding_url }}">
            </div>
        </div>
    </div>
    <div class="col-md-12">
        <x-forms.text fieldId="meta_keywords" :fieldLabel="__('biolinks::app.metaKeywords')" fieldName="meta_keywords"
            :fieldPlaceholder="__('placeholders.skills')" :fieldValue="$biolinkSettings->meta_keywords"/>
    </div>
    <div class="col-md-12">
        <div class="form-group">
            <x-forms.label class="my-3" fieldId="meta_description" :fieldLabel="__('biolinks::app.metaDescription')">
            </x-forms.label>
            <textarea name="meta_description" id="meta_description" rows="4" class="form-control">{!! $biolinkSettings->meta_description !!}</textarea>
        </div>
    </div>
</div>
