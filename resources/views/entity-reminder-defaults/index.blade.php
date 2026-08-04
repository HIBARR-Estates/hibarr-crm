@extends('layouts.app')

@section('content')

    @php
        $reminderTypes = [
            'minute' => __('app.minutes'),
            'hour' => __('app.hour'),
            'day' => __('app.days'),
        ];
    @endphp

    <!-- SETTINGS START -->
    <div class="w-100 d-flex">
        <x-setting-sidebar :activeMenu="$activeSettingMenu" />

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        @lang($pageTitle)
                    </h2>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
                <div class="row">
                    <div class="col-lg-12 mb-3">
                        <p class="f-13 text-lightest mb-0">
                            @lang('modules.settings.reminderDefaultsDescription')
                        </p>
                    </div>

                    <div class="col-lg-12 mb-3" id="add-entity-wrap"
                         @if(count($availableToAdd) === 0) style="display:none" @endif>
                        <div class="d-flex align-items-end flex-wrap">
                            <div class="form-group mb-0 mr-3" style="min-width: 220px;">
                                <label class="f-14 text-dark-grey mb-12" for="new_entity_type">
                                    @lang('modules.settings.addEntityDefault')
                                </label>
                                <select id="new_entity_type" class="form-control select-picker">
                                    <option value="">@lang('app.select')</option>
                                    @foreach ($availableToAdd as $type)
                                        <option value="{{ $type }}">{{ $entityTypeLabels[$type] ?? $type }}</option>
                                    @endforeach
                                </select>
                            </div>
                            <button type="button" class="btn btn-primary" id="add-entity-default">
                                <i class="fa fa-plus mr-1"></i> @lang('app.add')
                            </button>
                        </div>
                    </div>

                    <div class="col-lg-12" id="entity-defaults-container">
                        @forelse ($defaults as $default)
                            @include('entity-reminder-defaults.partials.entity-card', [
                                'entityType' => $default['entity_type'],
                                'entityLabel' => $entityTypeLabels[$default['entity_type']] ?? $default['entity_type'],
                                'reminders' => $default['reminders'],
                                'isActive' => $default['is_active'],
                                'reminderTypes' => $reminderTypes,
                            ])
                        @empty
                            <div class="alert alert-info" id="no-defaults-alert">
                                @lang('modules.settings.noReminderDefaults')
                            </div>
                        @endforelse
                    </div>

                    <div class="col-lg-12 mt-3">
                        <div class="bg-white rounded p-3 border">
                            <h5 class="f-14 font-weight-bold text-dark-grey mb-2">
                                <i class="fa fa-info-circle mr-1"></i> @lang('modules.settings.defaultReminders')
                            </h5>
                            <p class="f-12 text-lightest mb-0">
                                @lang('modules.settings.defaultRemindersDescription'):
                                1 @lang('app.hour'), 30 @lang('app.minutes'), 15 @lang('app.minutes'), 5 @lang('app.minutes')
                            </p>
                        </div>
                    </div>

                    <div class="col-lg-12 mt-4">
                        <div class="bg-white rounded p-3 border" id="email-templates-card">
                            <h5 class="f-14 font-weight-bold text-dark-grey mb-1">
                                @lang('modules.settings.emailTemplates')
                            </h5>
                            <p class="f-12 text-lightest mb-3">
                                @lang('modules.settings.emailTemplatesDescription')
                            </p>

                            <div class="row">
                                @foreach ($emailTemplates as $mailType => $templateId)
                                    <div class="col-md-6 mb-3">
                                        <label class="f-13 text-dark-grey mb-1" for="plunk_{{ $mailType }}">
                                            {{ $mailEntityTypeLabels[$mailType] ?? $mailType }}
                                            <span class="text-lightest">— @lang('modules.settings.plunkTemplateId')</span>
                                        </label>
                                        <input type="text"
                                               class="form-control height-35 plunk-template-input"
                                               id="plunk_{{ $mailType }}"
                                               data-mail-type="{{ $mailType }}"
                                               value="{{ $templateId ?? '' }}"
                                               placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                               maxlength="128"
                                               autocomplete="off">
                                    </div>
                                @endforeach
                            </div>

                            <button type="button" class="btn btn-primary" id="save-email-templates">
                                @lang('modules.settings.saveEmailTemplates')
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </x-setting-card>
    </div>
    <!-- SETTINGS END -->

@endsection

@push('scripts')
<template id="entity-card-template">
    @include('entity-reminder-defaults.partials.entity-card', [
        'entityType' => '__ENTITY_TYPE__',
        'entityLabel' => '__ENTITY_LABEL__',
        'reminders' => [],
        'isActive' => true,
        'reminderTypes' => $reminderTypes,
        'isTemplate' => true,
    ])
</template>

<script>
    $(document).ready(function () {
        const DEFAULT_REMINDERS = @json($fallbackOffsets);
        const REMINDER_TYPES = @json($reminderTypes);
        const ENTITY_LABELS = @json($entityTypeLabels);
        const UPDATE_URL = "{{ route('entity-reminder-defaults.update') }}";
        const DESTROY_URL = "{{ url('account/settings/entity-reminder-defaults') }}";
        const EMAIL_TEMPLATES_URL = "{{ route('entity-reminder-defaults.email-templates') }}";

        if ($.fn.selectpicker) {
            $('#new_entity_type').selectpicker('refresh');
        }

        function reminderRowHtml(reminder, index) {
            let typeOptions = '';
            Object.keys(REMINDER_TYPES).forEach(function (key) {
                const selected = reminder.type === key ? 'selected' : '';
                typeOptions += `<option value="${key}" ${selected}>${REMINDER_TYPES[key]}</option>`;
            });

            return `
                <tr data-index="${index}">
                    <td class="pl-20">
                        <input type="number" min="0" class="form-control height-35 reminder-time" value="${reminder.time}">
                    </td>
                    <td>
                        <select class="form-control height-35 reminder-type">${typeOptions}</select>
                    </td>
                    <td class="text-right pr-20">
                        <button type="button" class="btn btn-sm btn-outline-danger remove-reminder">
                            <i class="fa fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }

        function renderReminders($card, reminders) {
            const $tbody = $card.find('.reminders-body');
            $tbody.empty();
            (reminders.length ? reminders : DEFAULT_REMINDERS).forEach(function (reminder, index) {
                $tbody.append(reminderRowHtml(reminder, index));
            });
        }

        function collectReminders($card) {
            const reminders = [];
            $card.find('.reminders-body tr').each(function () {
                reminders.push({
                    time: parseInt($(this).find('.reminder-time').val(), 10) || 0,
                    type: $(this).find('.reminder-type').val()
                });
            });
            return reminders;
        }

        $('#entity-defaults-container .entity-default-card').each(function () {
            const $card = $(this);
            const reminders = $card.data('reminders');
            renderReminders($card, Array.isArray(reminders) ? reminders : DEFAULT_REMINDERS);
        });

        $(document).on('click', '.add-reminder', function () {
            const $card = $(this).closest('.entity-default-card');
            const reminders = collectReminders($card);
            if (reminders.length >= 20) {
                Swal.fire({
                    icon: 'warning',
                    text: "@lang('modules.settings.maxRemindersReached')"
                });
                return;
            }
            reminders.push({ time: 15, type: 'minute' });
            renderReminders($card, reminders);
        });

        $(document).on('click', '.remove-reminder', function () {
            const $card = $(this).closest('.entity-default-card');
            const reminders = collectReminders($card);
            const index = $(this).closest('tr').index();
            if (reminders.length <= 1) {
                return;
            }
            reminders.splice(index, 1);
            renderReminders($card, reminders);
        });

        $(document).on('click', '.save-entity-default', function () {
            const $card = $(this).closest('.entity-default-card');
            const entityType = $card.data('entity-type');
            const reminders = collectReminders($card);
            const isActive = $card.find('.entity-active').is(':checked');

            $.easyAjax({
                url: UPDATE_URL,
                type: 'POST',
                data: {
                    _token: '{{ csrf_token() }}',
                    entity_type: entityType,
                    reminders: reminders,
                    is_active: isActive ? 1 : 0
                },
                success: function (response) {
                    if (response.status === 'success') {
                        $card.data('reminders', response.default.reminders);
                        Swal.fire({
                            icon: 'success',
                            text: response.message,
                            timer: 1500,
                            showConfirmButton: false
                        });
                    }
                }
            });
        });

        $(document).on('click', '.delete-entity-default', function () {
            const $card = $(this).closest('.entity-default-card');
            const entityType = $card.data('entity-type');

            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('messages.recoverRecord')",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: "@lang('app.delete')",
                cancelButtonText: "@lang('app.cancel')",
                customClass: {
                    confirmButton: 'btn btn-danger mr-3',
                    cancelButton: 'btn btn-secondary'
                },
                buttonsStyling: false
            }).then(function (result) {
                if (!result.isConfirmed) {
                    return;
                }

                $.easyAjax({
                    url: DESTROY_URL + '/' + encodeURIComponent(entityType),
                    type: 'DELETE',
                    data: { _token: '{{ csrf_token() }}' },
                    success: function (response) {
                        if (response.status === 'success') {
                            const label = ENTITY_LABELS[entityType] || entityType;
                            $card.remove();
                            $('#new_entity_type').append(
                                $('<option>', { value: entityType, text: label })
                            );
                            if ($.fn.selectpicker) {
                                $('#new_entity_type').selectpicker('refresh');
                            }
                            $('#add-entity-wrap').show();

                            if ($('#entity-defaults-container .entity-default-card').length === 0) {
                                $('#entity-defaults-container').html(
                                    `<div class="alert alert-info" id="no-defaults-alert">@lang('modules.settings.noReminderDefaults')</div>`
                                );
                            }
                        }
                    }
                });
            });
        });

        $('#add-entity-default').on('click', function () {
            const entityType = $('#new_entity_type').val();
            if (!entityType) {
                return;
            }

            const label = ENTITY_LABELS[entityType] || entityType;
            const templateEl = document.getElementById('entity-card-template');
            let html = (templateEl.innerHTML || '')
                .replace(/__ENTITY_TYPE__/g, entityType)
                .replace(/__ENTITY_LABEL__/g, label);

            $('#no-defaults-alert').remove();
            $('#entity-defaults-container').append(html);

            const $card = $('#entity-defaults-container .entity-default-card').last();
            $card.attr('data-entity-type', entityType);
            $card.data('entity-type', entityType);
            $card.data('reminders', DEFAULT_REMINDERS);
            renderReminders($card, DEFAULT_REMINDERS);

            $('#new_entity_type option[value="' + entityType + '"]').remove();
            if ($.fn.selectpicker) {
                $('#new_entity_type').selectpicker('refresh');
            }
            if ($('#new_entity_type option').length <= 1) {
                $('#add-entity-wrap').hide();
            }

            $.easyAjax({
                url: UPDATE_URL,
                type: 'POST',
                data: {
                    _token: '{{ csrf_token() }}',
                    entity_type: entityType,
                    reminders: DEFAULT_REMINDERS,
                    is_active: 1
                }
            });
        });

        $('#save-email-templates').on('click', function () {
            const templates = {};
            $('.plunk-template-input').each(function () {
                templates[$(this).data('mail-type')] = ($(this).val() || '').trim();
            });

            $.easyAjax({
                url: EMAIL_TEMPLATES_URL,
                type: 'POST',
                data: {
                    _token: '{{ csrf_token() }}',
                    templates: templates
                },
                success: function (response) {
                    if (response.status === 'success' && response.templates) {
                        Object.keys(response.templates).forEach(function (type) {
                            $('#plunk_' + type).val(response.templates[type] || '');
                        });
                        Swal.fire({
                            icon: 'success',
                            text: response.message,
                            timer: 1500,
                            showConfirmButton: false
                        });
                    }
                }
            });
        });
    });
</script>
@endpush
