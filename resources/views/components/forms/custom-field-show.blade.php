@props(['fields', 'model' => null, 'categoryId' => null])
@php
    use App\Services\CustomFieldVisibilityService;
    
    $visibilityService = new CustomFieldVisibilityService();
    $customFieldsData = $model->custom_fields_data ?? [];
    
    // Prepare field values for visibility evaluation
    // Ensure keys are in format "field_47"
    $fieldValuesForVisibility = [];
    foreach ($customFieldsData as $key => $value) {
        if (strpos($key, 'field_') === 0) {
            $fieldValuesForVisibility[$key] = $value;
        } else {
            $fieldValuesForVisibility['field_' . $key] = $value;
        }
    }
@endphp
@if (isset($fields))
    @foreach ($fields as $field)
        @if (!is_null($categoryId) && $field->custom_field_category_id != $categoryId)
            @continue
        @endif
        
        @php
            // Check visibility rules
            $isVisible = $visibilityService->evaluate($field->id, $fieldValuesForVisibility);
        @endphp
        
        @if (!$isVisible)
            @continue
        @endif
        @if (in_array($field->type, ['text', 'password', 'number']))
            <x-cards.data-row :label="$field->label" :value="($model->custom_fields_data['field_' . $field->id] ?? null) === null || ($model->custom_fields_data['field_' . $field->id] ?? null) === '' ? '--' : $model->custom_fields_data['field_' . $field->id]">
            </x-cards.data-row>
        @elseif($field->type == 'textarea')
            <x-cards.data-row :label="$field->label" html="true" :value="($model->custom_fields_data['field_' . $field->id] ?? null) === null || ($model->custom_fields_data['field_' . $field->id] ?? null) === '' ? '--' : $model->custom_fields_data['field_' . $field->id]">
            </x-cards.data-row>
        @elseif($field->type == 'radio')
            <x-cards.data-row :label="$field->label" :value="!is_null($model->custom_fields_data['field_' . $field->id])
                ? $model->custom_fields_data['field_' . $field->id]
                : '--'">
            </x-cards.data-row>
        @elseif($field->type == 'checkbox')
            <x-cards.data-row :label="$field->label" :value="!is_null($model->custom_fields_data['field_' . $field->id])
                ? $model->custom_fields_data['field_' . $field->id]
                : '--'">
            </x-cards.data-row>
        @elseif($field->type == 'select')
            <x-cards.data-row :label="$field->label" :value="!is_null($model->custom_fields_data['field_' . $field->id]) &&
            $model->custom_fields_data['field_' . $field->id] != ''
                ? $field->values[$model->custom_fields_data['field_' . $field->id]]
                : '--'">
            </x-cards.data-row>
        @elseif($field->type == 'date')
            <x-cards.data-row :label="$field->label" :value="!is_null($model->custom_fields_data['field_' . $field->id]) &&
            $model->custom_fields_data['field_' . $field->id] != ''
                ? \Carbon\Carbon::parse($model->custom_fields_data['field_' . $field->id])->translatedFormat(
                    company()->date_format,
                )
                : '--'">
            </x-cards.data-row>
        @elseif($field->type == 'file')
            @php
                $fileValue = '--';
                if (
                    !is_null($model->custom_fields_data['field_' . $field->id]) &&
                    $model->custom_fields_data['field_' . $field->id] != ''
                ) {
                    $fileValue =
                        '<a href="' .
                        asset_url_local_s3('custom_fields/' . $model->custom_fields_data['field_' . $field->id]) .
                        '" class="text-dark-grey" download>' .
                        __('app.storageSetting.downloadFile') .
                        ' <i class="fa fa-question-circle" data-toggle="tooltip" data-placement="top" data-original-title="' .
                        __('app.downloadableFile') .
                        '" data-html="true" data-trigger="hover"></i></a>';
                }
            @endphp

            <x-cards.data-row :label="$field->label" :value="$fileValue">
            </x-cards.data-row>
        @endif
    @endforeach
@endif
