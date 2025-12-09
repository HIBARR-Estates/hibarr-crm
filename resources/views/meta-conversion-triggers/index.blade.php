@extends('layouts.app')

@section('content')
    <!-- SETTINGS START -->
    <div class="w-100 d-flex">
        <x-setting-sidebar :activeMenu="$activeSettingMenu" />
        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        @lang('app.menu.metaConversionTriggers')
                    </h2>
                </div>
            </x-slot>

            <x-slot name="buttons">
                <div class="row">
                    <div class="col-md-12 mb-2">
                        <x-forms.button-primary icon="plus" id="add-trigger" class="mb-2">
                            @lang('app.add') @lang('app.menu.metaConversionTriggers')
                        </x-forms.button-primary>
                    </div>
                </div>
            </x-slot>

            <div class="table-responsive p-20">
                <x-table class="table-bordered" id="triggers-table">
                    <x-slot name="thead">
                        <th>@lang('modules.deal.pipeline')</th>
                        <th>@lang('modules.deal.leadStage')</th>
                        <th>@lang('app.eventName')</th>
                        <th>@lang('app.value')</th>
                        <th>@lang('app.status')</th>
                        <th>@lang('app.action')</th>
                    </x-slot>
                    @forelse($triggers as $trigger)
                        <tr class="row{{ $trigger->id }}">
                            <td>{{ $trigger->pipeline->name ?? 'N/A' }}</td>
                            <td>{{ $trigger->stage->name ?? 'N/A' }}</td>
                            <td>
                                <span class="badge badge-lg {{ $trigger->active ? 'badge-success' : 'badge-danger' }}">
                                    {{ $trigger->event_name }}
                                </span>
                            </td>
                            <td>{{ number_format($trigger->value, 2) }}</td>
                            <td>
                                <div class="custom-control custom-switch">
                                    <input type="checkbox" class="custom-control-input toggle-status" 
                                           id="switch-{{ $trigger->id }}" 
                                           data-trigger-id="{{ $trigger->id }}" 
                                           {{ $trigger->active ? 'checked' : '' }}>
                                    <label class="custom-control-label" for="switch-{{ $trigger->id }}"></label>
                                </div>
                            </td>
                            <td>
                                <div class="task_view">
                                    <a data-trigger-id="{{ $trigger->id }}" 
                                       class="task_view_more d-flex align-items-center justify-content-center edit-trigger" 
                                       href="javascript:;">
                                        <i class="fa fa-edit icons mr-2"></i> {{ __('app.edit') }}
                                    </a>
                                </div>
                                <div class="task_view">
                                    <a data-trigger-id="{{ $trigger->id }}" 
                                       class="task_view_more d-flex align-items-center justify-content-center delete-trigger" 
                                       href="javascript:;">
                                        <i class="fa fa-trash icons mr-2"></i> {{ __('app.delete') }}
                                    </a>
                                </div>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6">
                                <x-cards.no-record icon="list" :message="__('messages.noRecordFound')" />
                            </td>
                        </tr>
                    @endforelse
                </x-table>
            </div>

        </x-setting-card>
    </div>
    <!-- SETTINGS END -->
@endsection

@push('scripts')
    <script>
        $(document).ready(function() {
            // Open create modal
            $('body').on('click', '#add-trigger', function() {
                var url = '{{ route('meta-conversion-triggers.create') }}';
                $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
                $.ajaxModal(MODAL_LG, url);
            });

            // Open edit modal
            $('body').on('click', '.edit-trigger', function() {
                var id = $(this).data('trigger-id');
                var url = '{{ route('meta-conversion-triggers.edit', ':id') }}';
                url = url.replace(':id', id);
                $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
                $.ajaxModal(MODAL_LG, url);
            });

            // Delete trigger
            $('body').on('click', '.delete-trigger', function() {
                var id = $(this).data('trigger-id');
                Swal.fire({
                    title: "@lang('messages.sweetAlertTitle')",
                    text: "@lang('messages.recoverRecord')",
                    icon: 'warning',
                    showCancelButton: true,
                    focusConfirm: false,
                    confirmButtonText: "@lang('messages.confirmDelete')",
                    cancelButtonText: "@lang('app.cancel')",
                    customClass: {
                        confirmButton: 'btn btn-primary mr-3',
                        cancelButton: 'btn btn-secondary'
                    },
                    showClass: {
                        popup: 'swal2-noanimation',
                        backdrop: 'swal2-noanimation'
                    },
                    buttonsStyling: false
                }).then((result) => {
                    if (result.isConfirmed) {
                        var url = '{{ route('meta-conversion-triggers.destroy', ':id') }}';
                        url = url.replace(':id', id);

                        $.easyAjax({
                            url: url,
                            type: 'POST',
                            data: { '_method': 'DELETE', '_token': '{{ csrf_token() }}' },
                            success: function(response) {
                                if (response.status == "success") {
                                    window.location.reload();
                                }
                            }
                        });
                    }
                });
            });

            // Toggle status
            $('body').on('change', '.toggle-status', function() {
                var id = $(this).data('trigger-id');
                var active = $(this).is(':checked') ? 1 : 0;
                var url = '{{ route('meta-conversion-triggers.update', ':id') }}';
                url = url.replace(':id', id);
                var $switch = $(this);
                var $row = $switch.closest('tr');
                var $badge = $row.find('.badge');

                $.easyAjax({
                    url: url,
                    type: 'POST',
                    data: {
                        '_method': 'PUT',
                        '_token': '{{ csrf_token() }}',
                        'active': active
                    },
                    success: function(response) {
                        if (response.status == "success") {
                            // Update badge color based on new status
                            if (active) {
                                $badge.removeClass('badge-danger').addClass('badge-success');
                            } else {
                                $badge.removeClass('badge-success').addClass('badge-danger');
                            }
                        }
                    },
                    error: function(response) {
                        // Revert switch if update failed
                        $switch.prop('checked', !active);
                    }
                });
            });
        });
    </script>

    <style>
        .badge-lg {
            font-size: 0.95rem;
            padding: 0.5rem 0.75rem;
            font-weight: 600;
        }
    </style>
@endpush

