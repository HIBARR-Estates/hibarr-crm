<div class="modal-header">
    <h5 class="modal-title" id="modelHeading">@lang('app.edit') @lang('performance::app.goalTypeSettings')</h5>
    <button type="button" onclick="removeOpenModal()" class="close" data-dismiss="modal" aria-label="Close">
        <span aria-hidden="true">×</span>
    </button>
</div>
<div class="modal-body">
    <div class="portlet-body">
        <x-form id="editGoalTypeForm" method="POST" class="ajax-form">
            @csrf
            @method('PUT')
            <input type="hidden" name="goal_type_id" id="goal_type_id" value="{{ $goalType->id }}">

            <div class="form-body">
                <div class="row">
                    <div class="col-lg-12">
                        <x-forms.label class="my-3" fieldId="type" :fieldLabel="__('app.type')" fieldRequired="true">
                        </x-forms.label>
                        <span class="input-group-text" id="type">{{ __('performance::app.' . $goalType->type) }}</span>
                        <input type="hidden" name="type" id="type" value="{{ $goalType->type }}">
                    </div>

                    <div class="col-lg-12 mt-4">
                        <div class="row">
                            <div class="col-lg-6">
                                <x-forms.label fieldId="view_by" :fieldLabel="__('performance::modules.viewedBy')"></x-forms.label>
                                <div class="row">
                                    <div class="col-lg-12 mt-3">
                                        <div class="row">
                                            <div class="col-lg-6">
                                                <x-forms.checkbox fieldId="view_by_owner" checked="{{ $goalType->view_by_owner ? 'checked' : '' }}" :fieldLabel="__('performance::app.owner')" fieldName="view_by_owner" />
                                            </div>
                                            <div class="col-lg-6">
                                                <x-forms.checkbox fieldId="view_by_manager" checked="{{ $goalType->view_by_manager ? 'checked' : '' }}" :fieldLabel="__('performance::modules.reportingManager')" fieldName="view_by_manager" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="col-lg-6">
                                <div class="form-group my-3">
                                    <x-forms.label fieldId="view_by_roles" :fieldLabel="__('performance::modules.orChooseRoles')" fieldRequired="true">
                                    </x-forms.label>
                                    <select class="form-control multiple-option" multiple name="view_by_roles[]"
                                        id="view_by_roles" data-live-search="true" data-size="8">
                                        @foreach ($roles as $role)
                                            <option value="{{ $role->id }}" {{ is_array($goalType->view_by_roles) ? (in_array($role->id, $goalType->view_by_roles) ? 'selected' : '') : (in_array($role->id, json_decode($goalType->view_by_roles, true)) ? 'selected' : '') }}>{{ $role->display_name }}</option>
                                        @endforeach
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-12 mt-5">
                        <div class="row">
                            <div class="col-lg-6">
                                <x-forms.label fieldId="manage_by" :fieldLabel="__('performance::modules.managedBy')"></x-forms.label>
                                <div class="row">
                                    <div class="col-lg-12 mt-3">
                                        <div class="row">
                                            <div class="col-lg-6">
                                                <x-forms.checkbox fieldId="manage_by_owner" checked="{{ $goalType->manage_by_owner ? 'checked' : '' }}" :fieldLabel="__('performance::app.owner')" fieldName="manage_by_owner" />
                                            </div>
                                            <div class="col-lg-6">
                                                <x-forms.checkbox fieldId="manage_by_manager" checked="{{ $goalType->manage_by_manager ? 'checked' : '' }}" :fieldLabel="__('performance::modules.reportingManager')" fieldName="manage_by_manager" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="col-lg-6">
                                <div class="form-group my-3">
                                    <x-forms.label fieldId="manage_by_roles" :fieldLabel="__('performance::modules.orChooseRoles')" fieldRequired="true">
                                    </x-forms.label>
                                    <select class="form-control multiple-option" multiple name="manage_by_roles[]"
                                        id="manage_by_roles" data-live-search="true" data-size="8">
                                        @foreach ($roles as $role)
                                            <option value="{{ $role->id }}" {{ is_array($goalType->manage_by_roles) ? (in_array($role->id, $goalType->manage_by_roles) ? 'selected' : '') : (in_array($role->id, json_decode($goalType->manage_by_roles, true)) ? 'selected' : '') }}>{{ $role->display_name }}</option>
                                        @endforeach
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </x-form>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
    <x-forms.button-primary id="save-goal-type" icon="check">@lang('app.update')</x-forms.button-primary>
</div>

<script>
    $("#type").selectpicker();

    $(".multiple-option").selectpicker({
        actionsBox: true,
        selectAllText: "{{ __('modules.permission.selectAll') }}",
        deselectAllText: "{{ __('modules.permission.deselectAll') }}",
        multipleSeparator: ", ",
        selectedTextFormat: "count > 8",
        countSelectedText: function(selected, total) {
            return selected + " {{ __('app.membersSelected') }} ";
        }
    });

    // Update goal type settings
    $('#save-goal-type').click(function() {
        $.easyAjax({
            url: "{{ route('goal-type-settings.update', $goalType->id) }}",
            container: '#editGoalTypeForm',
            type: "POST",
            redirect: true,
            file: true,
            data: $('#editGoalTypeForm').serialize(),
            disableButton: true,
            blockUI: true,
            buttonSelector: "#save-goal-type",
            success: function (response) {
                if (response.status == "success") {
                    window.location.reload();
                }
            }
        });
    });
</script>
