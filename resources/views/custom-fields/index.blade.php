@extends('layouts.app')

@push('styles')
<style>
    .sortable-fields tr[draggable="true"] {
        cursor: move;
        transition: background-color 0.2s;
    }
    
    .sortable-fields tr[draggable="true"]:hover {
        background-color: #f8f9fa;
    }
    
    .sortable-fields tr.dragging {
        opacity: 0.5;
        background-color: #e3f2fd;
    }
    
    .sortable-fields tr.drag-over {
        border-top: 3px solid #2196F3;
        background-color: #f0f7ff;
    }
    
    .sortable-fields tr[draggable="true"] td:first-child {
        user-select: none;
        width: 40px;
    }
    
    .sortable-fields tr[draggable="true"] td:first-child i {
        color: #6c757d;
        transition: color 0.2s;
    }
    
    .sortable-fields tr[draggable="true"]:hover td:first-child i {
        color: #2196F3;
    }
</style>
@endpush

@section('content')
    <div class="w-100 d-flex">
        @include('sections.setting-sidebar')

        <x-setting-card>

            <x-slot name="buttons">
                <div class="row">
                    <div class="col-md-12 mb-2">
                        <x-forms.button-primary icon="plus" id="add-field"
                                                class="mb-2"> @lang('modules.customFields.addField')
                        </x-forms.button-primary>
                    </div>
                </div>
            </x-slot>

            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                        @lang($pageTitle)
                    </h2>
                </div>
            </x-slot>

            <div class="px-20 pt-20">
                <form class="d-flex" onsubmit="return false;">
                    <div class="input-group rounded border-grey" style="max-width: 360px;">
                        <div class="input-group-prepend">
                            <span class="input-group-text border-0 bg-white">
                                <i class="fa fa-search f-12 text-lightest"></i>
                            </span>
                        </div>
                        <input type="text" id="customFieldSearch" class="form-control border-0 f-14 pl-0"
                               placeholder="@lang('modules.customFields.searchFields')"
                               autocomplete="off">
                    </div>
                </form>
            </div>

            <div class="table-responsive p-20 pipelineData">
                <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100" id="customFieldsContainer">
                    <div id="customFieldSearchNoResults" class="align-items-center d-flex flex-column text-lightest p-20 w-100" style="display: none;">
                        <i class="fa fa-search f-21 w-100"></i>
                        <div class="f-15 mt-4">
                            - @lang('messages.noRecordFound') -
                        </div>
                    </div>
                    @forelse($groupedCustomFields as $module => $fields)

                        <div class="row no-gutters border rounded my-3 px-4 py-2 custom-field-module-block" id="removeModule{{ $module }}" data-module="{{ $module }}">
                            <div class="col-md-6">
                                <div class="heading-h4">
                                    {{ $module }}
                                </div>

                                <div class="simple-text text-lightest mt-1">
                                    <span id="moduleCount{{ $module }}">{{ $fields->count() }}</span>

                                    @if($fields->count() == 1)
                                        @lang('modules.customFields.field')
                                    @else
                                        @lang('modules.customFields.fields')
                                    @endif
                                </div>

                            </div>
                            <div class="col-md-2 text-right module-header" data-module="{{ $module }}" style="margin-left: 390px;">
                                <x-forms.button-secondary class="view-pipeline">
                                    <i class="side-icon bi bi-kanban"></i>
                                    @lang('modules.customFields.viewFields')
                                </x-forms.button-secondary>
                            </div>
                        </div>

                        <div class="custom-fields-table" data-module="{{ $module }}" style="display: none;">
                            <x-table class="table-bordered" id="removeModuleColumns{{ $module }}">
                                <x-slot name="thead">
                                    <th style="width: 30px;"></th>
                                    <th>@lang('modules.customFields.moduleLabel')</th>
                                    <th>@lang('modules.customFields.type')</th>
                                    <th>@lang('modules.customFields.values')</th>
                                    <th>@lang('modules.customFields.required')</th>
                                    <th>@lang('modules.customFields.showInTable')</th>
                                    <th>@lang('modules.customFields.export')</th>
                                    <th>@lang('app.action')</th>
                                </x-slot>
                                <tbody class="sortable-fields" data-module="{{ $module }}">
                                @forelse($fields as $field)
                                    <tr class="row{{ $field->id }}" data-field-id="{{ $field->id }}" draggable="true"
                                        data-search="{{ strtolower($field->label . ' ' . $field->type . ' ' . $module) }}">
                                        <td>
                                            <div class="d-flex align-items-center justify-content-center" style="cursor: move;">
                                                <i class="fa fa-arrows-alt text-gray-400" style="font-size: 16px;"></i>
                                            </div>
                                        </td>
                                        <td>{{ $field->label }}</td>
                                        <td>{{ $field->type }}</td>
                                        <td>
                                            @if(isset($field->values) && $field->values != '[null]')
                                                @php
                                                    $decodedValues = is_string($field->values) ? json_decode($field->values, true) : $field->values;
                                                @endphp
                                                @if(is_array($decodedValues) && count($decodedValues) > 0)
                                                    <ul class="value-list">
                                                        @foreach($decodedValues as $value)
                                                            <li>
                                                                @if(is_array($value))
                                                                    {{-- Repeatable schema row: key (type) label --}}
                                                                    {{ ($value['key'] ?? '') }}{{ isset($value['type']) ? ' (' . ($value['type'] ?? '') . ')' : '' }}{{ isset($value['label']) && ($value['label'] ?? '') !== '' ? ': ' . ($value['label'] ?? '') : '' }}
                                                                @else
                                                                    {{ $value }}
                                                                @endif
                                                            </li>
                                                        @endforeach
                                                    </ul>
                                                @else
                                                    --
                                                @endif
                                            @else
                                                --
                                            @endif
                                        </td>
                                        <td>
                                            @if($field->required === 'yes')
                                                <span class="badge badge-danger disabled color-palette">@lang('app.yes')</span>
                                            @else
                                                <span class="badge badge-secondary disabled color-palette">@lang('app.no')</span>
                                            @endif
                                        </td>
                                        <td>
                                            @if($field->visible == 'true')
                                                <span class="badge badge-danger disabled color-palette">@lang('app.yes')</span>
                                            @else
                                                <span class="badge badge-secondary disabled color-palette">@lang('app.no')</span>
                                            @endif
                                        </td>
                                        <td>
                                            @if($field->export == 1)
                                                <span class="badge badge-danger disabled color-palette">@lang('app.yes')</span>
                                            @else
                                                <span class="badge badge-secondary disabled color-palette">@lang('app.no')</span>
                                            @endif
                                        </td>

                                        <td>
                                            <div class="task_view">
                                                <a data-user-id="{{ $field->id }}" class="task_view_more d-flex align-items-center justify-content-center edit-custom-field" href="javascript:;">
                                                    <i class="fa fa-edit icons mr-2"></i> {{ __('app.edit') }}
                                                </a>
                                            </div>
                                            <div class="task_view">
                                                <a data-user-id="{{ $field->id }}" data-module="{{ $module }}" class="task_view_more d-flex align-items-center justify-content-center sa-params" href="javascript:;">
                                                    <i class="fa fa-trash icons mr-2"></i> {{ __('app.delete') }}
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="8">
                                            <x-cards.no-record icon="list" :message="__('messages.noCustomField')" />
                                        </td>
                                    </tr>
                                @endforelse
                                </tbody>
                            </x-table>
                        </div>
                    @empty
                        <div class="align-items-center d-flex flex-column text-lightest p-20 w-100">
                            <i class="fa fa-clipboard f-21 w-100"></i>

                            <div class="f-15 mt-4">
                                - @lang('messages.noRecordFound') -
                            </div>
                        </div>
                    @endforelse
                </div>
            </div>

        </x-setting-card>
    </div>
@endsection

@push('scripts')

    <script>

        $(function () {

            // Hide all custom field tables initially
            $('.custom-fields-table').hide();

            // Search/filter custom fields by label, type, or module name
            $('#customFieldSearch').on('input', function () {
                var term = $.trim($(this).val()).toLowerCase();
                var anyModuleVisible = false;

                if (term === '') {
                    $('.custom-field-module-block').show();
                    $('.custom-fields-table tr[draggable="true"]').show();
                    $('.custom-fields-table').hide();
                    $('#customFieldSearchNoResults').hide();
                    return;
                }

                $('.custom-field-module-block').each(function () {
                    var module = $(this).data('module');
                    var $moduleBlock = $(this);
                    var $table = $('.custom-fields-table[data-module="' + module + '"]');
                    var matchCount = 0;

                    $table.find('tr[draggable="true"]').each(function () {
                        var haystack = $(this).data('search') || '';
                        var isMatch = String(haystack).indexOf(term) !== -1;
                        $(this).toggle(isMatch);
                        if (isMatch) matchCount++;
                    });

                    if (matchCount > 0) {
                        $moduleBlock.show();
                        $table.show();
                        anyModuleVisible = true;
                    } else {
                        $moduleBlock.hide();
                        $table.hide();
                    }
                });

                $('#customFieldSearchNoResults').toggle(!anyModuleVisible);
            });

            // Drag and drop functionality
            var draggedElement = null;
            var draggedIndex = null;

            $('body').on('dragstart', '.sortable-fields tr[draggable="true"]', function(e) {
                draggedElement = this;
                draggedIndex = $(this).index();
                $(this).addClass('dragging');
                e.originalEvent.dataTransfer.effectAllowed = 'move';
                e.originalEvent.dataTransfer.setData('text/plain', ''); // Required for Firefox
            });

            $('body').on('dragend', '.sortable-fields tr[draggable="true"]', function(e) {
                $(this).removeClass('dragging');
                $('.sortable-fields tr').removeClass('drag-over');
                draggedElement = null;
                draggedIndex = null;
            });

            $('body').on('dragover', '.sortable-fields', function(e) {
                if (e.preventDefault) {
                    e.preventDefault();
                }
                e.originalEvent.dataTransfer.dropEffect = 'move';
                
                if (!draggedElement) return false;
                
                var $target = $(e.target).closest('tr[draggable="true"]');
                if ($target.length === 0) return false;
                
                var $tbody = $(this);
                var $dragged = $(draggedElement);
                
                if (draggedElement !== $target[0] && $target.closest('tbody').is($tbody)) {
                    $('.sortable-fields tr').removeClass('drag-over');
                    $target.addClass('drag-over');
                    
                    var targetIndex = $target.index();
                    var draggedRowIndex = $dragged.index();
                    
                    if (targetIndex < draggedRowIndex) {
                        $target.before($dragged);
                    } else {
                        $target.after($dragged);
                    }
                }
                return false;
            });

            $('body').on('dragleave', '.sortable-fields tr[draggable="true"]', function(e) {
                // Only remove class if we're actually leaving the row
                var relatedTarget = e.originalEvent.relatedTarget;
                if (!$(this).find(relatedTarget).length && !$(this).is(relatedTarget)) {
                    $(this).removeClass('drag-over');
                }
            });

            $('body').on('drop', '.sortable-fields', function(e) {
                if (e.stopPropagation) {
                    e.stopPropagation();
                }
                e.preventDefault();
                
                var $tbody = $(this);
                $('.sortable-fields tr').removeClass('drag-over');
                
                if (draggedElement) {
                    saveFieldOrder($tbody);
                }
                return false;
            });

            function saveFieldOrder($tbody) {
                var module = $tbody.data('module');
                var sortedIds = [];
                $tbody.find('tr[draggable="true"]').each(function() {
                    var fieldId = $(this).data('field-id');
                    if (fieldId) {
                        sortedIds.push(fieldId);
                    }
                });

                if (sortedIds.length > 0) {
                    const token = "{{ csrf_token() }}";
                    const url = "{{ route('custom-fields.sort-fields') }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        data: {
                            '_token': token,
                            'sortedValues': sortedIds,
                            'module': module
                        },
                        blockUI: false,
                        success: function (response) {
                            if (response.status == "success") {
                                $.showToastr(response.message || 'Field order updated successfully', 'success');
                            }
                        },
                        error: function (response) {
                            $.showToastr('Failed to update field order', 'error');
                            // Reload page to restore original order
                            location.reload();
                        }
                    });
                }
            }

            // Toggle visibility of the custom fields table on module header click
            $('.module-header').click(function() {
                var module = $(this).data('module');
                var table = $('.custom-fields-table[data-module="' + module + '"]');
                table.toggle();
            });

            $('body').on('click', '.sa-params', function () {
                const id = $(this).data('user-id');
                var module = $(this).data('module');

                Swal.fire({
                    title: "@lang('messages.sweetAlertTitle')",
                    text: "@lang('messages.deleteField')",
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

                        let url = "{{ route('custom-fields.destroy',':id') }}";
                        url = url.replace(':id', id);

                        const token = "{{ csrf_token() }}";

                        $.easyAjax({
                            type: 'POST',
                            url: url,
                            blockUI: true,
                            data: {'_token': token, '_method': 'DELETE'},
                            success: function (response) {
                                if (response.status == "success") {
                                    $('.row'+id).fadeOut();
                                    const updatedCount = response.updatedCount;
                                    $('#moduleCount' + module).html(updatedCount);
                                    if (updatedCount == 0) {
                                        $('#removeModule' + module).fadeOut().remove();
                                        $('#removeModuleColumns' + module).fadeOut().remove();
                                    }
                                }
                            }
                        });
                    }
                });
            });

        });

        function updateFieldCount(module) {
            let fieldCount = $('.custom-fields-table[data-module="' + module + '"] tr').length - 1;
            let fieldText = fieldCount === 1 ? '@lang('modules.customFields.field')' : '@lang('modules.customFields.fields')';
            console.log(fieldCount+ ' ,'+fieldText);
            $('.module-header[data-module="' + module + '"]').siblings('.heading-h4').find('.simple-text').text(fieldCount + ' ' + fieldText);
        }

        $('body').on('click', '#add-field', function () {
            const url = "{{ route('custom-fields.create')}}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('body').on('click', '.edit-custom-field', function () {
            const id = $(this).data('user-id');
            let url = "{{ route('custom-fields.edit',':id') }}";
            url = url.replace(':id', id);
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

    </script>
@endpush
