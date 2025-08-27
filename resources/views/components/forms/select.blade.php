<x-forms.label :fieldId="$fieldId" :fieldLabel="$fieldLabel" :fieldRequired="$fieldRequired" :popover="$popover" class="mt-3"></x-forms.label>
<div {{ $attributes->merge(['class' => 'form-group mb-0']) }}>

    <select name="{{ $fieldName }}" id="{{ $fieldId }}" @if ($multiple) multiple @endif
        @if ($search) data-live-search="true" @endif class="form-control select-picker" data-size="8"
        @if ($alignRight) data-dropdown-align-right="true" @endif @disabled($changeDealStage == 'none')>
        {!! $slot !!}
    </select>

</div>

@if($withBadges)
<style>
    /* Stack employee items vertically and remove commas when using x-user-option */
    .filter-option-inner-inner {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
    }
    
    .filter-option-inner-inner > div {
        width: 100% !important;
    }
    
    /* Target Bootstrap Select's comma rendering */
    .filter-option-inner-inner > div:not(:last-child)::after {
        content: "" !important;
    }
    
    /* Alternative selector for comma removal */
    .filter-option-inner-inner > *:not(:last-child)::after {
        content: "" !important;
    }
</style>

<script>
$(document).ready(function() {
    // Remove commas from the select display
    function removeCommas() {
        // Target the specific Bootstrap Select structure
        const selectElement = document.getElementById('{{ $fieldId }}');
        if (!selectElement) {
            return;
        }
        
        // Find the Bootstrap Select button (next sibling)
        const button = selectElement.nextElementSibling;
        if (!button || !button.classList.contains('btn')) {
            return;
        }
        
        // Find the filter-option-inner-inner element
        const filterOption = button.querySelector('.filter-option-inner-inner');
        if (!filterOption) {
            return;
        }
        
        // Remove text nodes (commas) between div elements
        const walker = document.createTreeWalker(
            filterOption,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim() === ',') {
                textNodes.push(node);
            }
        }
        
        textNodes.forEach(node => {
            node.remove();
        });
        
        // Force the layout to update with CSS
        filterOption.style.display = 'flex';
        filterOption.style.flexDirection = 'column';
        filterOption.style.gap = '8px';
    }
    
    // Run on page load with multiple attempts
    setTimeout(removeCommas, 100);
    setTimeout(removeCommas, 500);
    setTimeout(removeCommas, 1000);
    setTimeout(removeCommas, 2000);
    
    // Run when select changes
    $('#{{ $fieldId }}').on('changed.bs.select', function() {
        setTimeout(removeCommas, 50);
    });
    
    // Also run when the select is refreshed
    $('#{{ $fieldId }}').on('refreshed.bs.select', function() {
        setTimeout(removeCommas, 50);
    });
    
    // Run periodically to catch any dynamic updates
    setInterval(removeCommas, 2000);
    
    // Also try to catch when Bootstrap Select is fully initialized
    $(document).on('shown.bs.select', function() {
        setTimeout(removeCommas, 100);
    });
    
    // Try to catch when the page is fully loaded
    $(window).on('load', function() {
        setTimeout(removeCommas, 500);
    });
    
    // Also try to catch when the dropdown is opened/closed
    $('#{{ $fieldId }}').on('show.bs.select', function() {
        setTimeout(removeCommas, 100);
    });
    
    $('#{{ $fieldId }}').on('hide.bs.select', function() {
        setTimeout(removeCommas, 100);
    });
});
</script>
@endif
