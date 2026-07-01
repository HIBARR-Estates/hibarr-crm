@props([
    'inputName',
    'items' => [],
    'selected' => [],
    'fieldIdPrefix' => 'scope',
    'hint' => null,
])

<div {{ $attributes->merge(['class' => 'form-group my-3']) }}>
    <div class="d-flex flex-wrap">
        @foreach($items as $item)
            @php
                $value = is_array($item) ? ($item['value'] ?? '') : $item;
                $label = is_array($item) ? ($item['label'] ?? '') : $item;
                $inputId = is_array($item) && !empty($item['id'])
                    ? $item['id']
                    : $fieldIdPrefix . '_' . md5($inputName . $value);
            @endphp
            <div class="mr-4 mb-2">
                <x-forms.checkbox
                    :fieldLabel="$label"
                    :fieldName="$inputName"
                    :fieldId="$inputId"
                    :fieldValue="$value"
                    :checked="in_array($value, $selected, true)" />
            </div>
        @endforeach
    </div>
    @if($hint)
        <p class="f-11 text-lightest mt-1 mb-0">{{ $hint }}</p>
    @endif
</div>
