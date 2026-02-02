@php
    $reminderTypes = [
        'minute' => __('app.minutes'),
        'hour' => __('app.hours'),
        'day' => __('app.days'),
    ];
@endphp

<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    <div class="row">
        <div class="col-lg-12">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 class="f-16 font-weight-bold mb-1">@lang('modules.settings.reminderPreferences')</h4>
                    <p class="f-13 text-lightest mb-0">@lang('modules.settings.reminderPreferencesDescription')</p>
                </div>
            </div>
        </div>

        <div class="col-lg-12">
            <x-cards.data :title="__('modules.settings.meetingReminders')">
                <div class="row">
                    <div class="col-md-12">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <label class="f-14 text-dark-grey mb-0">@lang('modules.settings.enableMeetingReminders')</label>
                            <div class="custom-control custom-switch">
                                <input type="checkbox" class="custom-control-input" id="meeting_reminders_active" 
                                       name="meeting_reminders_active" checked>
                                <label class="custom-control-label cursor-pointer" for="meeting_reminders_active"></label>
                            </div>
                        </div>
                        
                        <div class="table-responsive" id="meeting-reminders-container">
                            <table class="table table-hover" id="meeting-reminders-table">
                                <thead>
                                    <tr>
                                        <th class="pl-20">@lang('modules.settings.remindBefore')</th>
                                        <th>@lang('modules.settings.timeUnit')</th>
                                        <th class="text-right pr-20">@lang('app.action')</th>
                                    </tr>
                                </thead>
                                <tbody id="meeting-reminders-body">
                                    <!-- Reminders will be loaded here via JS -->
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="mt-3">
                            <button type="button" class="btn btn-outline-secondary btn-sm" id="add-meeting-reminder">
                                <i class="fa fa-plus mr-1"></i> @lang('modules.settings.addReminder')
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="row mt-4">
                    <div class="col-md-12">
                        <div class="d-flex justify-content-between">
                            <button type="button" class="btn btn-secondary" id="reset-meeting-reminders">
                                <i class="fa fa-undo mr-1"></i> @lang('modules.settings.resetToDefaults')
                            </button>
                            <button type="button" class="btn btn-primary" id="save-meeting-reminders">
                                <i class="fa fa-check mr-1"></i> @lang('app.save')
                            </button>
                        </div>
                    </div>
                </div>
            </x-cards.data>
        </div>
        
        <div class="col-lg-12 mt-3">
            <div class="bg-white rounded p-3 border">
                <h5 class="f-14 font-weight-bold text-dark-grey mb-2">
                    <i class="fa fa-info-circle mr-1"></i> @lang('modules.settings.defaultReminders')
                </h5>
                <p class="f-12 text-lightest mb-0">
                    @lang('modules.settings.defaultRemindersDescription'): 1 @lang('app.hour'), 30 @lang('app.minutes'), 15 @lang('app.minutes'), 5 @lang('app.minutes')
                </p>
            </div>
        </div>
    </div>
</div>

<script>
    $(document).ready(function() {
        const DEFAULT_REMINDERS = [
            { time: 1, type: 'hour' },
            { time: 30, type: 'minute' },
            { time: 15, type: 'minute' },
            { time: 5, type: 'minute' }
        ];
        
        const REMINDER_TYPES = @json($reminderTypes);
        
        let meetingReminders = [...DEFAULT_REMINDERS];
        let isActive = true;
        
        // Load current preferences
        loadPreferences();
        
        function loadPreferences() {
            $.easyAjax({
                url: "{{ route('reminder-preferences.index') }}",
                type: "GET",
                success: function(response) {
                    if (response.preferences && response.preferences.meeting) {
                        meetingReminders = response.preferences.meeting.reminders || DEFAULT_REMINDERS;
                        isActive = response.preferences.meeting.is_active !== false;
                        $('#meeting_reminders_active').prop('checked', isActive);
                    }
                    renderReminders();
                }
            });
        }
        
        function renderReminders() {
            const tbody = $('#meeting-reminders-body');
            tbody.empty();
            
            meetingReminders.forEach((reminder, index) => {
                const row = `
                    <tr data-index="${index}">
                        <td class="pl-20">
                            <input type="number" class="form-control form-control-sm reminder-time" 
                                   value="${reminder.time}" min="0" max="10080" style="width: 100px;">
                        </td>
                        <td>
                            <select class="form-control form-control-sm reminder-type select-picker" style="width: 120px;">
                                ${Object.entries(REMINDER_TYPES).map(([value, label]) => 
                                    `<option value="${value}" ${reminder.type === value ? 'selected' : ''}>${label}</option>`
                                ).join('')}
                            </select>
                        </td>
                        <td class="text-right pr-20">
                            <button type="button" class="btn btn-outline-danger btn-sm remove-reminder" 
                                    ${meetingReminders.length <= 1 ? 'disabled' : ''}>
                                <i class="fa fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
                tbody.append(row);
            });
            
            // Reinitialize select pickers if using bootstrap-select
            $('.select-picker').selectpicker('refresh');
        }
        
        // Add reminder
        $('#add-meeting-reminder').on('click', function() {
            if (meetingReminders.length >= 20) {
                Swal.fire({
                    icon: 'warning',
                    title: "@lang('messages.warning')",
                    text: "@lang('modules.settings.maxRemindersReached')"
                });
                return;
            }
            
            meetingReminders.push({ time: 10, type: 'minute' });
            renderReminders();
        });
        
        // Remove reminder
        $(document).on('click', '.remove-reminder', function() {
            const index = $(this).closest('tr').data('index');
            meetingReminders.splice(index, 1);
            renderReminders();
        });
        
        // Update reminder values
        $(document).on('change', '.reminder-time, .reminder-type', function() {
            const row = $(this).closest('tr');
            const index = row.data('index');
            
            meetingReminders[index] = {
                time: parseInt(row.find('.reminder-time').val()) || 0,
                type: row.find('.reminder-type').val()
            };
        });
        
        // Save reminders
        $('#save-meeting-reminders').on('click', function() {
            // Collect current values from form
            const reminders = [];
            $('#meeting-reminders-body tr').each(function() {
                reminders.push({
                    time: parseInt($(this).find('.reminder-time').val()) || 0,
                    type: $(this).find('.reminder-type').val()
                });
            });
            
            $.easyAjax({
                url: "{{ route('reminder-preferences.update') }}",
                type: "POST",
                data: {
                    entity_type: 'meeting',
                    reminders: reminders,
                    is_active: $('#meeting_reminders_active').is(':checked'),
                    _token: "{{ csrf_token() }}"
                },
                success: function(response) {
                    if (response.status === 'success') {
                        meetingReminders = response.preference.reminders;
                        renderReminders();
                    }
                }
            });
        });
        
        // Reset to defaults
        $('#reset-meeting-reminders').on('click', function() {
            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('modules.settings.resetRemindersConfirm')",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: "@lang('app.yes')",
                cancelButtonText: "@lang('app.no')"
            }).then((result) => {
                if (result.isConfirmed) {
                    $.easyAjax({
                        url: "{{ route('reminder-preferences.reset', 'meeting') }}",
                        type: "DELETE",
                        data: {
                            _token: "{{ csrf_token() }}"
                        },
                        success: function(response) {
                            if (response.status === 'success') {
                                meetingReminders = response.defaults || DEFAULT_REMINDERS;
                                $('#meeting_reminders_active').prop('checked', true);
                                renderReminders();
                            }
                        }
                    });
                }
            });
        });
    });
</script>
