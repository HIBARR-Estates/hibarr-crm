@php
    $entityType = $entityType ?? '__ENTITY_TYPE__';
    $entityLabel = $entityLabel ?? '__ENTITY_LABEL__';
    $reminders = $reminders ?? [];
    $isActive = $isActive ?? true;
    $reminderTypes = $reminderTypes ?? [];
    $isTemplate = $isTemplate ?? false;
@endphp

<div class="entity-default-card mb-4"
     data-entity-type="{{ $entityType }}"
     @unless($isTemplate) data-reminders='@json($reminders)' @endunless>
    <x-cards.data :title="$entityLabel">
        <div class="row">
            <div class="col-md-12">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <label class="f-14 text-dark-grey mb-0">@lang('modules.settings.enableReminders')</label>
                    <div class="custom-control custom-switch">
                        <input type="checkbox"
                               class="custom-control-input entity-active"
                               id="entity_active_{{ $entityType }}"
                               @if($isActive) checked @endif>
                        <label class="custom-control-label cursor-pointer"
                               for="entity_active_{{ $entityType }}"></label>
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
                        <tbody class="reminders-body">
                            {{-- filled by JS --}}
                        </tbody>
                    </table>
                </div>

                <div class="mt-3 d-flex justify-content-between flex-wrap">
                    <div>
                        <button type="button" class="btn btn-outline-secondary btn-sm add-reminder">
                            <i class="fa fa-plus mr-1"></i> @lang('modules.settings.addReminder')
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-sm delete-entity-default ml-2">
                            <i class="fa fa-trash mr-1"></i> @lang('app.delete')
                        </button>
                    </div>
                    <button type="button" class="btn btn-primary save-entity-default">
                        <i class="fa fa-check mr-1"></i> @lang('app.save')
                    </button>
                </div>
            </div>
        </div>
    </x-cards.data>
</div>
