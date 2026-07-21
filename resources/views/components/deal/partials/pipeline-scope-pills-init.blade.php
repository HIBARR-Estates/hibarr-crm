@once
<style>
    .pipeline-scope-pills__pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #e8f5ee;
        color: #16813D;
        font-size: 13px;
        padding: 4px 6px 4px 10px;
        border-radius: 999px;
        margin: 0 6px 6px 0;
    }

    .pipeline-scope-pills__pill-remove {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        padding: 0;
        border-radius: 50%;
        line-height: 1;
    }

    .pipeline-scope-pills__pill-remove:hover {
        background: rgba(0, 0, 0, 0.08);
    }

    .pipeline-scope-pills__dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background: #fff;
        border: 1px solid #e8eef3;
        border-radius: 4px;
        max-height: 220px;
        overflow-y: auto;
        z-index: 1070;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .pipeline-scope-pills__dropdown.pipeline-scope-pills__dropdown--portaled {
        position: fixed;
        right: auto;
        z-index: 1070;
    }

    .pipeline-scope-pills__dropdown-item {
        padding: 8px 12px;
        font-size: 14px;
        cursor: pointer;
        color: #28313c;
    }

    .pipeline-scope-pills__dropdown-item:hover {
        background: #f2f4f7;
    }

    .pipeline-scope-pills__dropdown-item.is-active {
        background: #e8f5ee;
    }

    .pipeline-scope-pills__dropdown-empty {
        padding: 10px 12px;
        font-size: 13px;
        color: #98a6ad;
    }
</style>

<script>
    window.initPipelineScopePills = window.initPipelineScopePills || function ($scope) {
        ($scope || $(document)).find('.pipeline-scope-pills:not([data-pills-init])').each(function () {
            var $root = $(this);
            $root.attr('data-pills-init', '1');

            function readJsonDataset($el, camelKey) {
                var value = $el.data(camelKey);
                if (Array.isArray(value)) {
                    return value;
                }
                if (value && typeof value === 'object') {
                    return value;
                }
                if (typeof value === 'string' && value !== '') {
                    try {
                        var parsed = JSON.parse(value);
                        return Array.isArray(parsed) ? parsed : [];
                    } catch (error) {
                        return [];
                    }
                }

                var dashedKey = camelKey.replace(/[A-Z]/g, function (char) {
                    return '-' + char.toLowerCase();
                });
                var raw = $el.attr('data-' + dashedKey);
                if (!raw) {
                    return [];
                }

                try {
                    var fallback = JSON.parse(raw);
                    return Array.isArray(fallback) ? fallback : [];
                } catch (error) {
                    return [];
                }
            }

            var options = readJsonDataset($root, 'options');
            var selected = readJsonDataset($root, 'selected').map(String).filter(function (value) {
                return options.some(function (option) {
                    return String(option.value) === String(value);
                });
            });
            var inputName = $root.data('input-name');
            var maxSelection = parseInt($root.data('max-selection'), 10);
            if (isNaN(maxSelection) || maxSelection <= 0) {
                maxSelection = 0;
            }
            var showCount = String($root.data('show-count')) !== '0';
            var countLabelTemplate = $root.data('count-label') || ':count selected';
            var noMatchesLabel = $root.data('no-matches') || 'No matches';
            var allSelectedLabel = $root.data('all-selected') || 'All options selected';

            var $pills = $root.find('.pipeline-scope-pills__pills');
            var $search = $root.find('.pipeline-scope-pills__search');
            var $dropdown = $root.find('.pipeline-scope-pills__dropdown');
            var $hiddenInputs = $root.find('.pipeline-scope-pills__hidden-inputs');
            var $count = $root.find('.pipeline-scope-pills__count');
            var highlightedIndex = -1;
            var currentRemaining = [];

            function isSelected(value) {
                return selected.some(function (item) {
                    return String(item) === String(value);
                });
            }

            function optionByValue(value) {
                return options.find(function (option) {
                    return String(option.value) === String(value);
                });
            }

            function syncHiddenInputs() {
                $hiddenInputs.empty();
                selected.forEach(function (value) {
                    if (!optionByValue(value)) {
                        return;
                    }

                    $('<input>', {
                        type: 'hidden',
                        name: inputName,
                        value: value,
                    }).appendTo($hiddenInputs);
                });
            }

            function updateCount() {
                if (!showCount) {
                    $count.text('');
                    return;
                }

                $count.text(countLabelTemplate.replace(':count', selected.length));
            }

            function renderPills() {
                $pills.empty();
                selected.forEach(function (value) {
                    var option = optionByValue(value);
                    if (!option) {
                        return;
                    }

                    var $pill = $('<div>', { class: 'pipeline-scope-pills__pill' });
                    $pill.append($('<span>').text(option.label));
                    $pill.append(
                        $('<button>', {
                            type: 'button',
                            class: 'pipeline-scope-pills__pill-remove',
                            'aria-label': option.label,
                        }).html('&times;').on('click', function (event) {
                            event.stopPropagation();
                            selected = selected.filter(function (item) {
                                return String(item) !== String(value);
                            });
                            renderPills();
                            openDropdown();
                        })
                    );
                    $pills.append($pill);
                });

                syncHiddenInputs();
                updateCount();
            }

            function selectOption(option) {
                if (maxSelection === 1) {
                    selected = [String(option.value)];
                } else {
                    selected.push(String(option.value));
                }
                $search.val('');
                highlightedIndex = -1;
                renderPills();
                renderDropdown();
                openDropdown();
            }

            function renderDropdown() {
                var query = ($search.val() || '').trim().toLowerCase();
                $dropdown.empty();

                var remaining = options.filter(function (option) {
                    return !isSelected(option.value);
                }).filter(function (option) {
                    return !query || option.label.toLowerCase().indexOf(query) !== -1;
                });

                currentRemaining = remaining;

                if (remaining.length === 0) {
                    highlightedIndex = -1;
                    $dropdown.append(
                        $('<div>', { class: 'pipeline-scope-pills__dropdown-empty' })
                            .text(query ? noMatchesLabel : allSelectedLabel)
                    );
                    return;
                }

                if (highlightedIndex >= remaining.length) {
                    highlightedIndex = remaining.length - 1;
                }
                if (highlightedIndex < 0) {
                    highlightedIndex = 0;
                }

                remaining.forEach(function (option, index) {
                    var isActive = index === highlightedIndex;
                    $('<div>', {
                        class: 'pipeline-scope-pills__dropdown-item' + (isActive ? ' is-active' : ''),
                        text: option.label,
                        tabindex: -1,
                        role: 'option',
                        'aria-selected': isActive ? 'true' : 'false',
                    })
                        .on('mousedown', function (event) {
                            // Keep focus in the search input so the dropdown stays usable.
                            event.preventDefault();
                        })
                        .on('click', function (event) {
                            event.stopPropagation();
                            selectOption(option);
                        })
                        .appendTo($dropdown);
                });
            }

            function ensureDropdownPortaled() {
                if ($dropdown.data('portaled')) {
                    return;
                }

                $dropdown
                    .addClass('pipeline-scope-pills__dropdown--portaled')
                    .data('portaled', true)
                    .data('portal-widget-id', $root.data('widget-id'));
                $('body').append($dropdown);
            }

            function positionDropdown() {
                if (!$search.length || !$search[0]) {
                    return;
                }

                var rect = $search[0].getBoundingClientRect();
                var viewportPadding = 8;
                var preferredMaxHeight = 220;
                var spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
                var spaceAbove = rect.top - viewportPadding;
                var openUpward = spaceBelow < 140 && spaceAbove > spaceBelow;
                var maxHeight = Math.max(
                    80,
                    Math.min(preferredMaxHeight, openUpward ? spaceAbove : spaceBelow)
                );

                $dropdown.css({
                    left: Math.max(viewportPadding, rect.left),
                    width: Math.min(rect.width, window.innerWidth - (viewportPadding * 2)),
                    maxHeight: maxHeight,
                    top: openUpward ? 'auto' : rect.bottom + 4,
                    bottom: openUpward ? (window.innerHeight - rect.top + 4) : 'auto',
                });
            }

            function bindDropdownReposition() {
                var widgetId = $root.data('widget-id') || 'default';
                var eventNamespace = '.pipelineScopePills_' + widgetId;

                if ($root.data('reposition-bound')) {
                    return;
                }

                $root.data('reposition-bound', true);

                var reposition = function () {
                    if (!$dropdown.hasClass('d-none')) {
                        positionDropdown();
                    }
                };

                $(window).on('scroll' + eventNamespace + ' resize' + eventNamespace, reposition);
                $root.closest('.modal-body').on('scroll' + eventNamespace, reposition);
                $root.data('reposition-handler', reposition);
                $root.data('reposition-namespace', eventNamespace);
            }

            function openDropdown() {
                $('.pipeline-scope-pills').not($root).each(function () {
                    $(this).find('.pipeline-scope-pills__dropdown').addClass('d-none');
                });
                $('.pipeline-scope-pills__dropdown--portaled').not($dropdown).addClass('d-none');

                renderDropdown();
                ensureDropdownPortaled();
                bindDropdownReposition();
                positionDropdown();
                $dropdown.removeClass('d-none');
            }

            function closeDropdown() {
                $dropdown.addClass('d-none');
            }

            $search.on('click focus input', function (event) {
                event.stopPropagation();
                if (event.type === 'input') {
                    highlightedIndex = 0;
                }
                openDropdown();
            });

            $dropdown.on('mousedown', function (event) {
                event.preventDefault();
            });
            $search.on('keydown', function (event) {
                if (event.key === 'Backspace' && !$search.val() && selected.length > 0) {
                    selected.pop();
                    renderPills();
                    openDropdown();
                }
                if (event.key === 'Escape') {
                    closeDropdown();
                }
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    openDropdown();
                    if (currentRemaining.length > 0) {
                        highlightedIndex = Math.min(highlightedIndex + 1, currentRemaining.length - 1);
                        renderDropdown();
                    }
                }
                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    if (currentRemaining.length > 0) {
                        highlightedIndex = Math.max(highlightedIndex - 1, 0);
                        renderDropdown();
                    }
                }
                if (event.key === 'Enter' && highlightedIndex >= 0 && currentRemaining[highlightedIndex]) {
                    event.preventDefault();
                    selectOption(currentRemaining[highlightedIndex]);
                }
            });

            renderPills();
            renderDropdown();

            $root.data('syncPipelineScopeInputs', syncHiddenInputs);
        });

        if (!window.syncPipelineScopePillsInputs) {
            window.syncPipelineScopePillsInputs = function ($scope) {
                ($scope || $(document)).find('.pipeline-scope-pills[data-pills-init]').each(function () {
                    var sync = $(this).data('syncPipelineScopeInputs');
                    if (typeof sync === 'function') {
                        sync();
                    }
                });
            };
        }

        if (!window._pipelineScopePillsDocBound) {
            window._pipelineScopePillsDocBound = true;
            $(document).on('click', function (event) {
                if (!$(event.target).closest('.pipeline-scope-pills').length
                    && !$(event.target).closest('.pipeline-scope-pills__dropdown').length) {
                    $('.pipeline-scope-pills__dropdown').addClass('d-none');
                }
            });
        }
    };

    initPipelineScopePills();
</script>
@endonce
