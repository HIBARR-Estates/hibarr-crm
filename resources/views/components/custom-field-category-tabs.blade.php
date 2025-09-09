@props(['customFieldCategories', 'defaultLabel' => 'app.generalInformation'])

@if (isset($customFieldCategories) && count($customFieldCategories) > 0)
    <div class="custom-field-tabs-wrapper" style="overflow-x: auto; overflow-y: hidden;">
        <div class="flex flex-nowrap gap-2 py-2" style="min-width: max-content;">
            <button type="button"
                class="tab-btn px-4 py-2 text-sm font-medium text-white bg-blue-600 border-b-2 border-blue-600 rounded-t transition-all duration-200"
                data-category-id="general" data-active="true">
                @lang($defaultLabel)
            </button>
            @foreach ($customFieldCategories as $category)
                <button type="button"
                    class="tab-btn px-4 py-2 text-sm font-medium whitespace-nowrap text-gray-700 bg-white border-b-2 border-gray-300 rounded-t transition-all duration-200"
                    data-category-id="{{ $category->id }}">
                    {{ $category->name }}
                </button>
            @endforeach
        </div>
    </div>
@endif


<script>
    $(document).ready(function() {
        // Category tab click handler
        $('[data-category-id]').on('click', function() {
            var categoryId = $(this).attr('data-category-id');
            // Remove highlight from all buttons
            $('[data-category-id]').removeClass(
                'active-category bg-blue-600 text-white border-blue-600').addClass(
                'bg-white text-gray-700 border-gray-300');
            // Add highlight to the clicked button
            $(this).addClass('active-category bg-blue-600 text-white border-blue-600').removeClass(
                'bg-white text-gray-700 border-gray-300');
            if (categoryId === 'general') {
                $('#normal-fields-container').show();
                $('.custom-fields-category-container').hide();
            } else {
                $('#normal-fields-container').hide();
                $('.custom-fields-category-container').hide();
                $('#custom-fields-category-' + categoryId).show();
            }
        });
        // Default state: highlight 'General Information'
        $('[data-category-id="general"]').addClass('active-category bg-blue-600 text-white border-blue-600')
            .removeClass('bg-white text-gray-700 border-gray-300');
        $('#normal-fields-container').show();
        $('.custom-fields-category-container').hide();
    });
</script>
