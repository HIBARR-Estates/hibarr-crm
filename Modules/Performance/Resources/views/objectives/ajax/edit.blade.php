<div class="row">
    <div class="col-md-12">
        <x-form id="edit-objective-form" method="POST" class="ajax-form">
            @csrf
            @method('PUT')
            <input type="hidden" name="objective_id" id="objective_id" value="{{ $objective->id }}">

            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal text-capitalize border-bottom-grey">
                    @lang('performance::app.objective')</h4>
                <div class="row p-20">
                    <div class="col-md-12">
                        <x-forms.text fieldId="title" :fieldLabel="__('performance::app.objectiveTitle')" fieldName="title" :fieldRequired="true" :fieldPlaceholder="__('performance::placeholders.objectiveTitle')" :fieldValue="$objective->title">
                        </x-forms.text>
                    </div>

                    <div class="col-md-12">
                        <x-forms.textarea fieldRequired="true" :fieldLabel="__('app.description')" :fieldPlaceholder="__('app.description')" fieldName="description" fieldId="description" :fieldValue="$objective->description"/>
                    </div>

                    <div class="col-md-4">
                        <x-forms.label class="my-3" fieldId="goal_type" :fieldLabel="__('performance::app.goalType')" fieldRequired="true">
                        </x-forms.label>
                        <x-forms.input-group>
                            <select class="form-control select-picker" name="goal_type" id="goal_type"
                                data-live-search="true">
                                @foreach ($goalTypes as $goalType)
                                    <option value="{{ $goalType->id }}" {{ $objective->goal_type == $goalType->id ? 'selected' : '' }} data-goal-type="{{ $goalType->type }}">{{ __('performance::app.' . $goalType->type) }}
                                    </option>
                                @endforeach
                            </select>
                        </x-forms.input-group>
                    </div>
                    <div class="col-md-4 {{ (!is_null($objective->department_id) && $objective->goal_type == 2) ? '' : 'd-none'  }}" id="departmentDiv">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="department_id" :fieldLabel="__('app.department')">
                            </x-forms.label>
                            <select class="form-control select-picker" name="department_id"
                                    id="department_id" data-live-search="true" data-size="8">
                                @foreach ($teams as $team)
                                    <option value="{{ $team->id }}" {{ $objective->department_id == $team->id ? 'selected' : '' }}>
                                        {{ $team->team_name }}
                                    </option>
                                @endforeach
                            </select>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <x-forms.datepicker fieldId="start_date" fieldRequired="true" :fieldLabel="__('app.startDate')"
                            fieldName="start_date" :fieldValue="\Carbon\Carbon::parse($objective->start_date)->format(company()->date_format)" :fieldPlaceholder="__('placeholders.date')" />
                    </div>
                    <div class="col-md-4">
                        <x-forms.datepicker fieldId="end_date" fieldRequired="true" :fieldLabel="__('app.endDate')" fieldName="end_date" :fieldValue="\Carbon\Carbon::parse($objective->end_date)->format(company()->date_format)" :fieldPlaceholder="__('placeholders.date')" />
                    </div>

                    <div class="col-lg-4">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="priority" fieldRequired="true" :fieldLabel="__('performance::app.priority')">
                            </x-forms.label>
                            <select class="form-control select-picker" name="priority"
                                    id="priority" data-live-search="true" data-size="3">
                                @foreach ($priorities as $key => $priority)
                                    <option value="{{ $key }}" {{ $objective->priority == $key ? 'selected' : '' }}>
                                        {{ $priority }}
                                    </option>
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
                                    <option value="{{ $key }}" {{ $objective->check_in_frequency == $key ? 'selected' : '' }}>
                                        {{ $frequency }}
                                    </option>
                                @endforeach
                            </select>
                        </div>
                    </div>

                    <div class="col-md-4 @if($objective->check_in_frequency == 'daily') d-none @endif" id="scheduleOnDiv">
                        <x-forms.select fieldId="schedule_on" :fieldLabel="__('app.scheduleOn')" fieldName="schedule_on" fieldRequired="true" search="true">
                            <option value="">--</option>
                            <option value="every-monday" @if($objective->schedule_on == 'every-monday') selected @endif>@lang('app.every') @lang('app.monday')</option>
                            <option value="every-tuesday" @if($objective->schedule_on == 'every-tuesday') selected @endif>@lang('app.every') @lang('app.tuesday')</option>
                            <option value="every-wednesday" @if($objective->schedule_on == 'every-wednesday') selected @endif>@lang('app.every') @lang('app.wednesday')</option>
                            <option value="every-thursday" @if($objective->schedule_on == 'every-thursday') selected @endif>@lang('app.every') @lang('app.thursday')</option>
                            <option value="every-friday" @if($objective->schedule_on == 'every-friday') selected @endif>@lang('app.every') @lang('app.friday')</option>
                            <option value="every-saturday" @if($objective->schedule_on == 'every-saturday') selected @endif>@lang('app.every') @lang('app.saturday')</option>
                            <option value="every-sunday" @if($objective->schedule_on == 'every-sunday') selected @endif>@lang('app.every') @lang('app.sunday')</option>
                        </x-forms.select>
                    </div>

                    <div class="col-md-4 @if(is_null($objective->rotation_date)) d-none @endif" id="dateDiv">
                        <x-forms.select fieldId="rotation_date" :fieldLabel="__('app.scheduleDate')" fieldName="rotation_date"
                        fieldRequired="true" search="true">
                            <option value="">--</option>
                            @foreach ($dates as $date)
                                <option value="{{ $date }}" @if($objective->rotation_date == $date) selected @endif>{{ $date }}</option>
                            @endforeach
                        </x-forms.select>
                    </div>

                    <div class="col-md-4 mt-5">
                        <x-forms.checkbox class="mr-0 mr-lg-2 mr-md-2" :popover="__('performance::app.sendReminderNote')" :fieldLabel="__('performance::app.sendCheckInReminder')"
                            fieldName="send_check_in_reminder" fieldId="send_check_in_reminder" fieldValue="yes"
                            fieldRequired="true" :checked="$objective->send_check_in_reminder == 1"/>
                    </div>

                    <div class="col-md-8">
                        <div class="form-group my-3">
                            <x-forms.label fieldId="selectAssignee" fieldRequired="true" :fieldLabel="__('performance::app.owners')">
                            </x-forms.label>
                            <x-forms.input-group>
                                <select class="form-control multiple-users" multiple name="owner_id[]"
                                    id="selectAssignee" data-live-search="true" data-size="8">
                                    @foreach ($employees as $emp)
                                        <x-user-option :user="$emp" :pill=true  :selected="in_array($emp->id, $ownerArray)"/>
                                    @endforeach
                                </select>
                            </x-forms.input-group>
                        </div>
                    </div>
                </div>

                <x-form-actions>
                    <x-forms.button-primary id="save-objective" class="mr-3" icon="check">@lang('app.update')
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="route('objectives.index')" class="border-0">@lang('app.cancel')
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

            const url = "{{ route('objectives.update', $objective->id) }}";
            var data = $('#edit-objective-form').serialize();

            if (url) {
                $.easyAjax({
                    url: url,
                    container: '#edit-objective-form',
                    type: "POST",
                    disableButton: true,
                    blockUI: true,
                    file: true,
                    data: data,
                    success: function(response) {
                        if (response.status == "success") {
                            const redirectUrl = "{{ route('objectives.index') }}";
                            window.location.href = redirectUrl;
                        }
                    }
                });
            }
        });

        init(RIGHT_MODAL);
    });

</script>
