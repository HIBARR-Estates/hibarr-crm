@php
    $reminders = $leadCadence['reminders'] ?? [];
    $isActive = $leadCadence['is_active'] ?? true;
    $configured = $leadCadence['configured'] ?? false;
    $reminderTypes = $reminderTypes ?? [];
@endphp

<div class="lead-cadence-card mb-4"
     data-configured="{{ $configured ? '1' : '0' }}"
     data-reminders='@json($reminders)'>
    <x-cards.data :title="__('modules.settings.leadMeetingCadence')">
        <div class="row">
            <div class="col-md-12">
                <p class="f-13 text-lightest mb-3">
                    @lang('modules.settings.leadMeetingCadenceDescription')
                </p>

                <div class="d-flex justify-content-between align-items-center mb-3">
                    <label class="f-14 text-dark-grey mb-0">@lang('modules.settings.enableReminders')</label>
                    <div class="custom-control custom-switch">
                        <input type="checkbox"
                               class="custom-control-input lead-cadence-active"
                               id="lead_cadence_active"
                               @if($isActive) checked @endif>
                        <label class="custom-control-label cursor-pointer"
                               for="lead_cadence_active"></label>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th class="pl-20">@lang('modules.settings.remindBefore')</th>
                                <th>@lang('modules.settings.timeUnit')</th>
                                <th class="text-right pr-20">@lang('app.action')</th>
                            </tr>
                        </thead>
                        <tbody class="lead-cadence-reminders-body">
                            {{-- filled by JS --}}
                        </tbody>
                    </table>
                </div>

                <div class="mt-3 d-flex justify-content-between flex-wrap">
                    <div>
                        <button type="button" class="btn btn-outline-secondary btn-sm" id="lead-cadence-add-reminder">
                            <i class="fa fa-plus mr-1"></i> @lang('modules.settings.addReminder')
                        </button>
                        <button type="button"
                                class="btn btn-outline-danger btn-sm ml-2"
                                id="lead-cadence-delete"
                                @unless($configured) style="display:none" @endunless>
                            <i class="fa fa-trash mr-1"></i> @lang('modules.settings.clearLeadMeetingCadence')
                        </button>
                    </div>
                    <button type="button" class="btn btn-primary" id="lead-cadence-save">
                        <i class="fa fa-check mr-1"></i> @lang('app.save')
                    </button>
                </div>

                <p class="f-12 text-lightest mb-0 mt-3">
                    @lang('modules.settings.leadMeetingCadenceDeleteHint')
                </p>
            </div>
        </div>
    </x-cards.data>
</div>
