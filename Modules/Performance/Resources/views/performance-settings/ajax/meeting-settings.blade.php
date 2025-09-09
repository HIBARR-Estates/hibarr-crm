<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    @method('PUT')
    <div class="row">
        <div class="col-lg-12 mt-2">
            <div class="row">
                <div class="col-md-12">
                    <x-forms.label fieldId="view_by" :fieldLabel="__('performance::modules.whoCanCreateMeetings')"></x-forms.label>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 pt-1">
                    <div class="row">
                        <div class="col-md-3 mt-2">
                            <x-forms.label fieldId="create_meeting_roles" :fieldLabel="__('performance::modules.chooseRoles')">
                            </x-forms.label>
                        </div>
                        <div class="col-md-6 pt-0">
                            <select class="form-control multiple-option" multiple name="create_meeting_roles[]"
                                id="create_meeting_roles" data-live-search="true" data-size="8">
                                @foreach ($roles as $role)
                                    <option value="{{ $role->id }}" {{ is_array($setting->create_meeting_roles) ? (in_array($role->id, $setting->create_meeting_roles) ? 'selected' : '') : (in_array($role->id, json_decode($setting->create_meeting_roles, true)) ? 'selected' : '') }}>{{ $role->display_name }}</option>
                                @endforeach
                            </select>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mt-2">
                    <x-forms.checkbox fieldId="create_meeting_manager" :fieldLabel="__('performance::modules.reportingManager')" fieldName="create_meeting_manager" checked="{{ $setting->create_meeting_manager ? 'checked' : '' }}"/>
                </div>
                <div class="col-md-3 mt-2">
                    <x-forms.checkbox fieldId="create_meeting_participant" :fieldLabel="__('performance::modules.participantsOnlyManage')" fieldName="create_meeting_participant" checked="{{ $setting->create_meeting_participant ? 'checked' : '' }}"/>
                </div>
            </div>
        </div>

        <div class="col-lg-12 mt-5">
            <div class="row">
                <div class="col-md-12">
                    <x-forms.label fieldId="view_by" :fieldLabel="__('performance::modules.whoCanViewMeetings')"></x-forms.label>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 pt-1">
                    <div class="row">
                        <div class="col-md-3 mt-2">
                            <x-forms.label fieldId="view_meeting_roles" :fieldLabel="__('performance::modules.chooseRoles')">
                            </x-forms.label>
                        </div>
                        <div class="col-md-6 pt-0">
                            <select class="form-control multiple-option" multiple name="view_meeting_roles[]"
                                id="view_meeting_roles" data-live-search="true" data-size="8">
                                @foreach ($roles as $role)
                                    <option value="{{ $role->id }}" {{ is_array($setting->view_meeting_roles) ? (in_array($role->id, $setting->view_meeting_roles) ? 'selected' : '') : (in_array($role->id, json_decode($setting->view_meeting_roles, true)) ? 'selected' : '') }}>{{ $role->display_name }}</option>
                                @endforeach
                            </select>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 mt-2">
                    <x-forms.checkbox fieldId="view_meeting_manager" :fieldLabel="__('performance::modules.reportingManager')" fieldName="view_meeting_manager" checked="{{ $setting->view_meeting_manager ? 'checked' : '' }}"/>
                </div>
                <div class="col-md-3 mt-2">
                    <x-forms.checkbox fieldId="view_meeting_participant" :fieldLabel="__('performance::modules.participantsOnly')" fieldName="view_meeting_participant" checked="{{ $setting->view_meeting_participant ? 'checked' : '' }}"/>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Button Start -->
<div class="w-100 border-top-grey">
    <x-setting-form-actions>
        <x-forms.button-primary id="save-meeting-form" data-setting-id="{{ $setting->id }}" class="mr-3" icon="check">@lang('app.save')
        </x-forms.button-primary>
    </x-setting-form-actions>
</div>
<!-- Button End -->

<script>
    $('.multiple-option').selectpicker('refresh');
</script>
