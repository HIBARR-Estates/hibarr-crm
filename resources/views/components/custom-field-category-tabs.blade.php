@props(['customFieldCategories', 'defaultLabel' => 'app.generalInformation'])

@if (isset($customFieldCategories) && count($customFieldCategories) > 0)
    <div class="w-full max-w-full overflow-x-auto scrollbar-hide" style="overflow-x: auto; overflow-y: hidden;">
        <div class="flex flex-nowrap gap-0 border-b border-gray-200 min-w-0" style="min-width: max-content;">
            <button type="button"
                class="tab-category-btn text-sm  text-gray-700 bg-transparent border-none border-b-2 border-transparent px-4 py-2 whitespace-nowrap transition-all duration-200 focus:outline-none"
                data-category-id="general" data-active="true">
                @lang($defaultLabel)
            </button>
            @foreach ($customFieldCategories as $category)
                <button type="button"
                    class="tab-category-btn text-sm font-normal text-gray-700 bg-transparent border-none border-b-2 border-transparent px-4 py-2 whitespace-nowrap transition-all duration-200 focus:outline-none"
                    data-category-id="{{ $category->id }}">
                    {{ $category->name }}
                </button>
            @endforeach
        </div>
    </div>

    <style>
        .tab-category-btn {
            appearance: none;
            background: none;
            border-radius: 0;
            border: none;
            border-bottom: 2px solid transparent;
            color: #374151;
            font-size: 0.90rem;
            font-weight: 400;
            padding: 0.5rem 1rem;
            margin: 0;
            transition: border-color 0.2s, color 0.2s, background 0.2s;
            cursor: pointer;
        }
        .tab-category-btn.active-category,
        .tab-category-btn.bg-blue-600 {
            border-bottom: 2px solid #2563eb;
            color: #2563eb !important;
            background: #f3f4f6;
            font-weight: 600;
        }
        .tab-category-btn:focus {
            outline: none;
            border-bottom: 2px solid #2563eb;
        }
        .scrollbar-hide {
            scrollbar-width: none;
            -ms-overflow-style: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        /* Responsive font size for legibility */
        @media (max-width: 600px) {
            .tab-category-btn {
                font-size: 0.95rem;
                padding: 0.5rem 0.75rem;
            }
        }
    </style>
@endif


<script>
    $(document).ready(function() {
        const $panel = $('.task-detail-panel.in');
        // Decide the target container
        const $scope = $panel.length ? $panel : $(document);

        // Category tab click handler
        $scope.find('[data-category-id]').on('click', function() {
            var categoryId = $(this).attr('data-category-id');

            // Remove highlight from all buttons within the scope
            $scope.find('[data-category-id]')
                .removeClass('active-category bg-blue-600 text-white border-blue-600')
                .addClass('bg-white text-gray-700 border-gray-300');

            // Add highlight to the clicked button
            $(this).addClass('active-category bg-blue-600 text-white border-blue-600')
                .removeClass('bg-white text-gray-700 border-gray-300');

            // Toggle visibility
            if (categoryId === 'general') {
                $scope.find('#normal-fields-container').show();
                $scope.find('.custom-fields-category-container').hide();
            } else {
                $scope.find('#normal-fields-container').hide();
                $scope.find('.custom-fields-category-container').hide();
                $scope.find('#custom-fields-category-' + categoryId).show();
            }
        });

        // Default state: highlight 'General Information'
        $scope.find('[data-category-id="general"]')
            .addClass('active-category bg-blue-600 text-white border-blue-600')
            .removeClass('bg-white text-gray-700 border-gray-300');

        $scope.find('#normal-fields-container').show();
        $scope.find('.custom-fields-category-container').hide();
    });
</script>
