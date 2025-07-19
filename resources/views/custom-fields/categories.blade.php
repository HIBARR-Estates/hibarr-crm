@extends('layouts.app')
@section('title', __('app.menu.customFields') . ' - ' . __('modules.customFields.category'))

@section('content')
    <div class="content-wrapper">
        <div class="d-flex justify-content-between my-3">
            <div>
                <h4 class="mb-0 f-21 text-capitalize font-weight-bold">@lang('modules.customFields.category')</h4>
            </div>
            <div class="d-flex">
                <x-forms.button-primary id="add-category" icon="plus">
                    @lang('modules.customFields.addCategory')
                </x-forms.button-primary>
            </div>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>@lang('app.name')</th>
                                <th>@lang('app.module')</th>
                                <th>@lang('app.action')</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($categories as $category)
                                <tr>
                                    <td>{{ $category->name }}</td>
                                    <td>{{ $category->customFieldGroup->name ?? 'N/A' }}</td>
                                    <td>
                                        <div class="task_view">
                                            <a href="javascript:;" class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                                <i class="fa fa-ellipsis-v"></i>
                                            </a>
                                            <div class="dropdown-menu dropdown-menu-right border-grey rounded b-shadow-4 p-0" aria-labelledby="dropdownMenuLink" tabindex="0">
                                                <a class="dropdown-item openRightModal" href="javascript:;" data-url="{{ route('custom-field-categories.edit', $category->id) }}">
                                                    <i class="fa fa-edit mr-2"></i>@lang('app.edit')
                                                </a>
                                                <a class="dropdown-item delete-category" href="javascript:;" data-category-id="{{ $category->id }}">
                                                    <i class="fa fa-trash mr-2"></i>@lang('app.delete')
                                                </a>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="3" class="text-center">@lang('messages.noRecordFound')</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Add Category Modal -->
    <div class="modal fade" id="addCategoryModal" tabindex="-1" role="dialog" aria-labelledby="addCategoryModalLabel" aria-hidden="true">
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
                                <x-forms.text :fieldLabel="__('app.name')" fieldName="name" fieldId="category_name" fieldRequired="true" />
                            </div>
                            <div class="col-lg-12">
                                <x-forms.select fieldId="custom_field_group_id" :fieldLabel="__('app.module')" fieldName="custom_field_group_id" search="true">
                                    <option value="">@lang('app.select') @lang('app.module')</option>
                                    @foreach($customFieldGroups as $group)
                                        <option value="{{ $group->id }}">{{ $group->name }}</option>
                                    @endforeach
                                </x-forms.select>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
                        <x-forms.button-primary id="save-category" icon="check">@lang('app.save')</x-forms.button-primary>
                    </div>
                </x-form>
            </div>
        </div>
    </div>

    <!-- Edit Category Modal -->
    <div class="modal fade" id="editCategoryModal" tabindex="-1" role="dialog" aria-labelledby="editCategoryModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="editCategoryModalLabel">@lang('modules.customFields.editCategory')</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <x-form id="editCategoryForm" method="PUT" class="ajax-form">
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-lg-12">
                                <x-forms.text :fieldLabel="__('app.name')" fieldName="name" fieldId="edit_category_name" fieldRequired="true" />
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.cancel')</x-forms.button-cancel>
                        <x-forms.button-primary id="update-category" icon="check">@lang('app.save')</x-forms.button-primary>
                    </div>
                </x-form>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
<script>
    $(document).ready(function() {
        $(".select-picker").selectpicker();
        
        // Add Category
        $('#add-category').click(function() {
            $('#addCategoryModal').modal('show');
        });

        $('#save-category').click(function () {
            $.easyAjax({
                url: "{{ route('custom-field-categories.store') }}",
                container: '#addCategoryForm',
                type: "POST",
                data: $('#addCategoryForm').serialize(),
                blockUI: true,
                buttonSelector: "#save-category",
                success: function (response) {
                    if (response.status === 'success') {
                        window.location.reload();
                    }
                }
            });
            return false;
        });

        // Edit Category
        $('.openRightModal').click(function() {
            var url = $(this).data('url');
            $.easyAjax({
                url: url,
                type: "GET",
                success: function (response) {
                    if (response.status === 'success') {
                        $('#edit_category_name').val(response.category.name);
                        $('#editCategoryForm').attr('action', "{{ route('custom-field-categories.update', ':id') }}".replace(':id', response.category.id));
                        $('#editCategoryModal').modal('show');
                    }
                }
            });
        });

        // Update Category
        $('#update-category').click(function () {
            $.easyAjax({
                url: $('#editCategoryForm').attr('action'),
                container: '#editCategoryForm',
                type: "POST",
                data: $('#editCategoryForm').serialize(),
                blockUI: true,
                buttonSelector: "#update-category",
                success: function (response) {
                    if (response.status === 'success') {
                        window.location.reload();
                    }
                }
            });
            return false;
        });

        // Delete Category
        $('.delete-category').click(function() {
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
                        url: "{{ route('custom-field-categories.destroy', ':id') }}".replace(':id', categoryId),
                        type: "DELETE",
                        success: function (response) {
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