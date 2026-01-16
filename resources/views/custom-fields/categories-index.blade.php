@extends('layouts.app')
@section('title', __('app.menu.customFieldCategories'))

@push('styles')
<style>
    .sortable-categories tr[draggable="true"] {
        cursor: move;
        transition: background-color 0.2s;
    }
    
    .sortable-categories tr[draggable="true"]:hover {
        background-color: #f8f9fa;
    }
    
    .sortable-categories tr.dragging {
        opacity: 0.5;
        background-color: #e3f2fd;
    }
    
    .sortable-categories tr.drag-over {
        border-top: 3px solid #2196F3;
        background-color: #f0f7ff;
    }
    
    .sortable-categories tr[draggable="true"] td:first-child {
        user-select: none;
        width: 40px;
    }
    
    .sortable-categories tr[draggable="true"] td:first-child i {
        color: #6c757d;
        transition: color 0.2s;
    }
    
    .sortable-categories tr[draggable="true"]:hover td:first-child i {
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
                        <x-forms.button-primary id="add-category" icon="plus">
                            @lang('modules.customFields.addCategory')
                        </x-forms.button-primary>
                    </div>
                </div>
            </x-slot>

            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        @lang('app.menu.customFieldCategories')
                    </h2>
                </div>
            </x-slot>

            <div class="table-responsive p-20">
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th style="width: 40px;"></th>
                            <th>@lang('app.name')</th>
                            <th>@lang('app.module')</th>
                            <th>@lang('app.action')</th>
                        </tr>
                    </thead>
                    <tbody class="sortable-categories">
                        @forelse($categories as $category)
                            <tr class="row{{ $category->id }}" data-category-id="{{ $category->id }}" draggable="true">
                                <td>
                                    <div class="d-flex align-items-center justify-content-center" style="cursor: move;">
                                        <i class="fa fa-arrows-alt text-gray-400" style="font-size: 16px;"></i>
                                    </div>
                                </td>
                                <td>{{ $category->name }}</td>
                                <td>{{ $category->customFieldGroup->name ?? 'N/A' }}</td>
                                <td>
                                    <div class="task_view">
                                        <a href="javascript:;"
                                            class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle"
                                            data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                            <i class="fa fa-ellipsis-v"></i>
                                        </a>
                                        <div class="dropdown-menu dropdown-menu-right border-grey rounded b-shadow-4 p-0"
                                            aria-labelledby="dropdownMenuLink" tabindex="0">
                                            <a class="dropdown-item openRightModal" href="{{ route('custom-field-categories.edit', $category->id) }}">
                                                <i class="fa fa-edit mr-2"></i>@lang('app.edit')
                                            </a>
                                            <a class="dropdown-item delete-category" href="javascript:;"
                                                data-category-id="{{ $category->id }}">
                                                <i class="fa fa-trash mr-2"></i>@lang('app.delete')
                                            </a>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="4" class="text-center">@lang('messages.noRecordFound')</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </x-setting-card>
    </div>

    <!-- Add Category Modal -->
    <div class="modal fade" id="addCategoryModal" tabindex="-1" role="dialog" aria-labelledby="addCategoryModalLabel"
        aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="addCategoryModalLabel">@lang('modules.customFields.addCategory')</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <x-form id="addCategoryForm" method="POST" class="ajax-form">
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-lg-12">
                                <x-forms.text :fieldLabel="__('app.name')" fieldName="name" fieldId="category_name"
                                    fieldRequired="true" />
                            </div>
                            <div class="col-lg-12">
                                <x-forms.select fieldId="custom_field_group_id" :fieldLabel="__('app.module')"
                                    fieldName="custom_field_group_id" search="true">
                                    <option value="">@lang('app.select') @lang('app.module')</option>
                                    @foreach ($customFieldGroups as $group)
                                        <option value="{{ $group->id }}">{{ $group->name }}</option>
                                    @endforeach
                                </x-forms.select>
                            </div>
                            <div class="col-lg-12">
                                <x-forms.number :fieldLabel="__('modules.customFields.orderSequence')" fieldName="order" 
                                    fieldId="order" :fieldValue="0" 
                                    :fieldPlaceholder="__('modules.customFields.orderSequencePlaceholder')" />
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <x-forms.button-cancel data-dismiss="modal"
                            class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
                        <x-forms.button-primary id="save-category"
                            icon="check">@lang('app.save')</x-forms.button-primary>
                    </div>
                </x-form>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
    <script>
        $(function () {
            $(".select-picker").selectpicker();

            // Drag and drop functionality
            var draggedElement = null;
            var draggedIndex = null;

            $('body').on('dragstart', '.sortable-categories tr[draggable="true"]', function(e) {
                draggedElement = this;
                draggedIndex = $(this).index();
                $(this).addClass('dragging');
                e.originalEvent.dataTransfer.effectAllowed = 'move';
                e.originalEvent.dataTransfer.setData('text/plain', ''); // Required for Firefox
            });

            $('body').on('dragend', '.sortable-categories tr[draggable="true"]', function(e) {
                $(this).removeClass('dragging');
                $('.sortable-categories tr').removeClass('drag-over');
                draggedElement = null;
                draggedIndex = null;
            });

            $('body').on('dragover', '.sortable-categories', function(e) {
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
                    $('.sortable-categories tr').removeClass('drag-over');
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

            $('body').on('dragleave', '.sortable-categories tr[draggable="true"]', function(e) {
                // Only remove class if we're actually leaving the row
                var relatedTarget = e.originalEvent.relatedTarget;
                if (!$(this).find(relatedTarget).length && !$(this).is(relatedTarget)) {
                    $(this).removeClass('drag-over');
                }
            });

            $('body').on('drop', '.sortable-categories', function(e) {
                if (e.stopPropagation) {
                    e.stopPropagation();
                }
                e.preventDefault();
                
                var $tbody = $(this);
                $('.sortable-categories tr').removeClass('drag-over');
                
                if (draggedElement) {
                    saveCategoryOrder($tbody);
                }
                return false;
            });

            function saveCategoryOrder($tbody) {
                var sortedIds = [];
                $tbody.find('tr[draggable="true"]').each(function() {
                    var categoryId = $(this).data('category-id');
                    if (categoryId) {
                        sortedIds.push(categoryId);
                    }
                });

                if (sortedIds.length > 0) {
                    const token = "{{ csrf_token() }}";
                    const url = "{{ route('custom-field-categories.sort') }}";

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        data: {
                            '_token': token,
                            'sortedIds': sortedIds
                        },
                        blockUI: false,
                        success: function (response) {
                            if (response.status == "success") {
                                $.showToastr(response.message || 'Category order updated successfully', 'success');
                            }
                        },
                        error: function (response) {
                            $.showToastr('Failed to update category order', 'error');
                            // Reload page to restore original order
                            location.reload();
                        }
                    });
                }
            }

            // Add Category
            $('#add-category').click(function() {
                $('#addCategoryModal').modal('show');
            });

            $('#save-category').click(function() {
                $.easyAjax({
                    url: "{{ route('custom-field-categories.store') }}",
                    container: '#addCategoryForm',
                    type: "POST",
                    data: $('#addCategoryForm').serialize(),
                    blockUI: true,
                    buttonSelector: "#save-category",
                    success: function(response) {
                        if (response.status === 'success') {
                            window.location.reload();
                        }
                    }
                });
                return false;
            });

            // Delete Category
            $('body').on('click', '.delete-category', function() {
                var categoryId = $(this).data('category-id');

                Swal.fire({
                    title: "@lang('messages.sweetAlertTitle')",
                    text: "@lang('messages.recoverRecord')",
                    icon: 'warning',
                    showCancelButton: true,
                    focusConfirm: false,
                    confirmButtonText: "@lang('messages.confirmDelete')",
                    cancelButtonText: "@lang('app.cancel')",
                    buttonsStyling: false,
                    showClass: {
                        popup: 'swal2-noanimation',
                        backdrop: 'swal2-noanimation'
                    },
                    customClass: {
                        confirmButton: 'btn btn-danger mr-3',
                        cancelButton: 'btn btn-secondary'
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        $.easyAjax({
                            url: "{{ route('custom-field-categories.destroy', ':id') }}"
                                .replace(':id', categoryId),
                            type: "DELETE",
                            success: function(response) {
                                if (response.status === 'success') {
                                    window.location.reload();
                                }
                            }
                        });
                    }
                });
            });
        });
    </script>
@endpush
