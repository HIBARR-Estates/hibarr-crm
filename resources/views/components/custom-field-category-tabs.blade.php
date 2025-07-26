@props(['customFieldCategories', 'defaultLabel' => 'app.generalInformation'])

@if (isset($customFieldCategories) && count($customFieldCategories) > 0)
    <div class="flex gap-3">
        <button type="button"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
            data-category-id="general" data-active="true">
            @lang($defaultLabel)
        </button>
        @foreach ($customFieldCategories as $category)
            <button type="button"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                data-category-id="{{ $category->id }}">
                {{ $category->name }}
            </button>
        @endforeach
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
