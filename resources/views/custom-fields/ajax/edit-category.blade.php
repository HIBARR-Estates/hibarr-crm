<x-form id="editCategoryForm" method="PUT" class="ajax-form">
    <input type="hidden" name="id" value="{{ $category->id }}" />
    <div class="row">
        <div class="col-lg-12">
            <x-forms.text :fieldLabel="__('app.name')" fieldName="name" fieldId="edit_category_name"
                fieldRequired="true" :fieldValue="$category->name" />
        </div>
        <div class="col-lg-12">
            <x-forms.select fieldId="edit_custom_field_group_id" :fieldLabel="__('app.module')"
                fieldName="custom_field_group_id" search="true" :fieldValue="$category->custom_field_group_id">
                <option value="">@lang('app.select') @lang('app.module')</option>
                @foreach ($customFieldGroups as $group)
                    <option value="{{ $group->id }}" @if($category->custom_field_group_id == $group->id) selected @endif>{{ $group->name }}</option>
                @endforeach
            </x-forms.select>
        </div>
        <div class="col-lg-12">
            <x-forms.number :fieldLabel="__('modules.customFields.orderSequence')" fieldName="order" 
                fieldId="edit_order" :fieldValue="$category->order ?? 0" 
                :fieldPlaceholder="__('modules.customFields.orderSequencePlaceholder')" />
        </div>
    </div>
    <div class="mt-3">
        <x-forms.button-cancel class="border-0 mr-3" id="close-right-modal">@lang('app.cancel')</x-forms.button-cancel>
        <x-forms.button-primary id="update-category"
            icon="check">@lang('app.save')</x-forms.button-primary>
    </div>
</x-form>

<script>
    $(document).ready(function() {
        $(".select-picker").selectpicker();

        $('#update-category').click(function() {
            var formData = $('#editCategoryForm').serialize();
            formData += '&_method=PUT';

            $.easyAjax({
                url: "{{ route('custom-field-categories.update', $category->id) }}",
                container: '#editCategoryForm',
                type: "POST",
                data: formData,
                blockUI: true,
                buttonSelector: "#update-category",
                success: function(response) {
                    if (response.status === 'success') {
                        window.location.reload();
                    }
                }
            });
            return false;
        });

        $('#close-right-modal').click(function() {
            $('#close-task-detail').click();
        });
    });
</script>
