<div class="row">
    <div class="col-md-4 mt-3">
        <div class="form-group">
            <x-forms.label fieldId="is_sensitive" :popover="__('biolinks::app.warningNote')"
                        :fieldLabel="__('biolinks::app.warning')"></x-forms.label>
            <div class="custom-control custom-switch">
                <input type="checkbox"
                    @checked($biolinkSettings->is_sensitive == \Modules\Biolinks\Enums\YesNo::Yes)
                    class="custom-control-input change-module-setting"
                    id="is_sensitive" name="is_sensitive" value="yes">
                <label class="custom-control-label cursor-pointer" for="is_sensitive"></label>
            </div>
        </div>
    </div>

    <div class="col-md-8">
        <x-forms.label class="mt-3" fieldId="password"
            :fieldLabel="__('app.password')" fieldRequired="false">
        </x-forms.label>
        <x-forms.input-group>
            <input type="password" name="password" id="password"
                class="form-control height-35 f-14" >
            <x-slot name="preappend">
                <button type="button" data-toggle="tooltip"
                    data-original-title="@lang('app.viewPassword')"
                    class="btn btn-outline-secondary border-grey height-35 toggle-password"><i
                        class="fa fa-eye"></i></button>
            </x-slot>
        </x-forms.input-group>
        <small class="form-text text-muted">@lang('placeholders.password')</small>
    </div>
</div>
