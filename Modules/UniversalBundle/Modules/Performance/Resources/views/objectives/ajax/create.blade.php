<div class="row">
    <div class="col-md-12">
        <x-form id="save-objective-form">

            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal text-capitalize border-bottom-grey">
                    @lang('performance::app.objective')</h4>
                <input type="hidden" name="meeting_id" id="meeting_id" value="{{ $meetingId }}">
                <div class="row p-20">
                    <div class="col-md-12">
                        <x-forms.text fieldId="title" :fieldLabel="__('performance::app.objectiveTitle')" fieldName="title" :fieldRequired="true" :fieldPlaceholder="__('performance::placeholders.objectiveTitle')">
                        </x-forms.text>
                    </div>

                    <div class="col-md-12">
                        <x-forms.textarea fieldRequired="true" :fieldLabel="__('app.description')" :fieldPlaceholder="__('app.description')" fieldName="description" fieldId="description"/>
                    </div>

                    <div class="col-md-4">
                        <x-forms.label class="my-3" fieldId="goal_type" :fieldLabel="__('performance::app.goalType')" fieldRequired="true">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="goal_type" id="goal_type" data-live-search="true">
                                @foreach ($goalTypes as $goalType)
                                    <option value="{{ $goalType->id }}" data-goal-type="{{ $goalType->type }}">
                                        {{ __('performance::app.' . $goalType->type) }}
                                    </option>
                                @endforeach
                            </select>
                        </x-forms.input-group>
                    </div>
                    <div class="col-md-4 d-none" id="departmentDiv">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="department_id" :fieldLabel="__('app.department')">
                            </x-forms.label>
                            <select class="form-control select-picker" name="department_id" id="department_id" data-live-search="true" data-size="8">
                                @foreach ($teams as $team)
                                    <option value="{{ $team->id }}">{{ $team->team_name }}</option>
                                @endforeach
                            </select>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <x-forms.datepicker fieldId="start_date" fieldRequired="true" :fieldLabel="__('app.startDate')"
                            fieldName="start_date" :fieldValue="now($company->timezone)->format($company->date_format)" :fieldPlaceholder="__('placeholders.date')" />
                    </div>

                    <div class="col-md-4">
                        <x-forms.datepicker fieldId="end_date" fieldRequired="true" :fieldLabel="__('app.endDate')" fieldName="end_date" :fieldValue="now($company->timezone)->addHour()->format($company->date_format)" :fieldPlaceholder="__('placeholders.date')" />
                    </div>

                    <div class="col-lg-4">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="priority" fieldRequired="true" :fieldLabel="__('performance::app.priority')">
                            </x-forms.label>
                            <select class="form-control select-picker" name="priority"
                                    id="priority" data-live-search="true" data-size="3">
                                @foreach ($priorities as $key => $priority)
                                    <option value="{{ $key }}">{{ $priority }}</option>
                                @endforeach
                            </select>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="check_in_frequency" fieldRequired="true" :fieldLabel="__('performance::app.checkInFrequency')">
                            </x-forms.label>
                            <select class="form-control select-picker" name="check_in_frequency"
                                    id="check_in_frequency" data-live-search="true" data-size="5">
                                @foreach ($checkInFrequency as $key => $frequency)
                                    <option value="{{ $key }}">{{ $frequency }}</option>
                                @endforeach
                            </select>
                        </div>
                    </div>

                    <div class="col-md-4 d-none" id="scheduleOnDiv">
                        <x-forms.select fieldId="schedule_on" :fieldLabel="__('performance::app.checkInDay')" fieldName="schedule_on"
                            fieldRequired="true" search="true">
                            <option value="">--</option>
                            <option value="every-monday">@lang('app.every') @lang('app.monday')</option>
                            <option value="every-tuesday">@lang('app.every') @lang('app.tuesday')</option>
                            <option value="every-wednesday">@lang('app.every') @lang('app.wednesday')</option>
                            <option value="every-thursday">@lang('app.every') @lang('app.thursday')</option>
                            <option value="every-friday">@lang('app.every') @lang('app.friday')</option>
                            <option value="every-saturday">@lang('app.every') @lang('app.saturday')</option>
                            <option value="every-sunday">@lang('app.every') @lang('app.sunday')</option>
                        </x-forms.select>
                    </div>

                    <div class="col-md-4 d-none" id="dateDiv">
                        <x-forms.select fieldId="rotation_date" :fieldLabel="__('performance::app.checkInDate')" fieldName="rotation_date"
                            fieldRequired="true" search="true">
                            <option value="">--</option>
                            @foreach ($dates as $date)
                                <option value="{{ $date }}">{{ $date }}</option>
                            @endforeach
                        </x-forms.select>
                    </div>

                    <div class="col-md-4 mt-5">
                        <x-forms.checkbox class="mr-0 mr-lg-2 mr-md-2" :popover="__('performance::app.sendReminderNote')" :fieldLabel="__('performance::app.sendCheckInReminder')"
                            fieldName="send_check_in_reminder" fieldId="send_check_in_reminder" fieldValue="yes"
                            fieldRequired="true" :checked='true'/>
                    </div>

                    <div class="col-md-4">
                        <x-forms.select fieldId="project_id" fieldName="project_id" :fieldLabel="__('app.project')"
                                        :popover="__('modules.tasks.notFinishedProjects')"
                                        search="true">
                            <option value="">--</option>
                            @foreach ($projects as $data)
                                <option
                                    data-content="{!! '<strong>'.$data->project_short_code."</strong> ".$data->project_name !!}"
                                   value="{{ $data->id }}">
                                </option>
                            @endforeach
                        </x-forms.select>
                    </div>

                    <div class="col-lg-8">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="selectAssignee" fieldRequired="true"
                                :fieldLabel="__('performance::app.owners')">
                            </x-forms.label>
                            <x-forms.input-group>
                                <select class="form-control multiple-users" multiple name="owner_id[]"
                                    id="selectAssignee" data-live-search="true" data-size="8">
                                    @foreach ($employees as $item)
                                        <x-user-option :user="$item" :pill="true"/>
                                    @endforeach
                                </select>
                            </x-forms.input-group>
                        </div>
                    </div>
                </div>

                <x-form-actions>
                    <x-forms.button-primary id="save-objective" class="mr-3" icon="check">@lang('app.save')
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="$currentUrl" class="border-0">@lang('app.cancel')
                    </x-forms.button-cancel>
                </x-form-actions>
            </div>
        </x-form>

    </div>
</div>

<script>

    $(document).ready(function() {

        $('.select-picker').selectpicker();

        datepicker('#start_date', {
            position: 'bl',
            ...datepickerConfig
        });

        datepicker('#end_date', {
            position: 'bl',
            ...datepickerConfig
        });

        $("#selectAssignee").selectpicker({
            actionsBox: true,
            selectAllText: "{{ __('modules.permission.selectAll') }}",
            deselectAllText: "{{ __('modules.permission.deselectAll') }}",
            multipleSeparator: " ",
            selectedTextFormat: "count > 8",
            countSelectedText: function(selected, total) {
                return selected + " {{ __('app.membersSelected') }} ";
            }
        });

        $('body').on('change', '#check_in_frequency', function() {
            let rotation = $(this).val();
            $('#scheduleOnDiv').toggleClass('d-none', !(rotation == 'weekly' || rotation == 'bi-weekly'));
            $('#dateDiv').toggleClass('d-none', !(rotation == 'monthly' || rotation == 'quarterly'));
        });

        $('#goal_type').change(function() {
            let goal = $(this).find('option:selected').data('goal-type');

            if (goal === 'department') {
                $('#departmentDiv').removeClass('d-none');
            } else {
                $('#departmentDiv').addClass('d-none');
            }
        }).trigger('change');

        $('#department_id').change(function() {
            var id = $(this).val();
            var url = "{{ route('employees.by_department', ':id') }}";
            url = url.replace(':id', id);

            $.easyAjax({
                url: url,
                container: '#save-objective-form',
                type: "GET",
                blockUI: true,
                data: $('#save-objective-form').serialize(),
                success: function(response) {
                    if (response.status == 'success') {
                        $('#selectAssignee').html(response.data);
                        $('#selectAssignee').selectpicker('refresh');
                    }
                }
            });
        });

        $('#save-objective').click(function() {

            const url = "{{ route('objectives.store') }}";
            var data = $('#save-objective-form').serialize();

            if (url) {
                $.easyAjax({
                    url: url,
                    container: '#save-objective-form',
                    type: "POST",
                    disableButton: true,
                    blockUI: true,
                    file: true,
                    data: data,
                    success: function(response) {
                        if (response.status == "success") {

                            let objectiveId = response.objectiveId;
                            let meetingId = response.meetingId;
                            const redirectUrl = "{{ route('key-results.create') }}?objectiveId="+objectiveId+"&meetingId="+meetingId;
                            window.location.href = redirectUrl;
                        }
                    }
                });
            }
        });

        init(RIGHT_MODAL);
    });

</script>
