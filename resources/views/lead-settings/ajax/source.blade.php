<style>
    .sortable-sources tr[draggable="true"] {
        cursor: move;
        transition: background-color 0.2s;
    }

    .sortable-sources tr[draggable="true"]:hover {
        background-color: #f8f9fa;
    }

    .sortable-sources tr.dragging {
        opacity: 0.5;
        background-color: #e3f2fd;
    }

    .sortable-sources tr.drag-over {
        border-top: 3px solid #2196F3;
        background-color: #f0f7ff;
    }

    .sortable-sources tr[draggable="true"] td:first-child {
        user-select: none;
        width: 40px;
    }

    .sortable-sources tr[draggable="true"] td:first-child i {
        color: #6c757d;
        transition: color 0.2s;
    }

    .sortable-sources tr[draggable="true"]:hover td:first-child i {
        color: #2196F3;
    }
</style>

<div class="table-responsive p-20">
    <x-table class="table-bordered">
        <x-slot name="thead">
            <th style="width: 30px;"></th>
            <th>@lang('app.name')</th>
            <th class="text-right">@lang('app.action')</th>
        </x-slot>

        <tbody class="sortable-sources">
            @forelse($leadSources as $key => $source)
                <tr class="row{{ $source->id }} item-row" data-row-id="{{ $source->id }}" draggable="true">
                    <td>
                        <div class="d-flex align-items-center justify-content-center" style="cursor: move;">
                            <i class="fa fa-arrows-alt text-gray-400" style="font-size: 16px;"></i>
                        </div>
                    </td>
                    <td>{{ $source->type }}</td>
                    <td class="text-right">
                        <div class="task_view">
                            <a href="javascript:;" data-source-id="{{ $source->id }}"
                                class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle edit-source">
                                <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                            </a>
                        </div>
                        <div class="task_view mt-1 mt-lg-0 mt-md-0">
                            <a href="javascript:;" data-source-id="{{ $source->id }}"
                                class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle delete-source">
                                <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')
                            </a>
                        </div>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="4">
                        <x-cards.no-record icon="list" :message="__('messages.noLeadSourceAdded')" />
                    </td>
                </tr>
            @endforelse
        </tbody>
    </x-table>
</div>

<script>
    $(function() {
        var draggedElement = null;

        $('body').off('dragstart', '.sortable-sources tr[draggable="true"]').on('dragstart', '.sortable-sources tr[draggable="true"]', function(e) {
            draggedElement = this;
            $(this).addClass('dragging');
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.setData('text/plain', ''); // Required for Firefox
        });

        $('body').off('dragend', '.sortable-sources tr[draggable="true"]').on('dragend', '.sortable-sources tr[draggable="true"]', function(e) {
            $(this).removeClass('dragging');
            $('.sortable-sources tr').removeClass('drag-over');
            draggedElement = null;
        });

        $('body').off('dragover', '.sortable-sources').on('dragover', '.sortable-sources', function(e) {
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
                $('.sortable-sources tr').removeClass('drag-over');
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

        $('body').off('dragleave', '.sortable-sources tr[draggable="true"]').on('dragleave', '.sortable-sources tr[draggable="true"]', function(e) {
            var relatedTarget = e.originalEvent.relatedTarget;
            if (!$(this).find(relatedTarget).length && !$(this).is(relatedTarget)) {
                $(this).removeClass('drag-over');
            }
        });

        $('body').off('drop', '.sortable-sources').on('drop', '.sortable-sources', function(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            e.preventDefault();

            var $tbody = $(this);
            $('.sortable-sources tr').removeClass('drag-over');

            if (draggedElement) {
                saveSourceOrder($tbody);
            }
            return false;
        });

        function saveSourceOrder($tbody) {
            var sourceIds = [];
            $tbody.find('tr[draggable="true"]').each(function() {
                var id = $(this).data('row-id');
                if (id) {
                    sourceIds.push(id);
                }
            });

            if (sourceIds.length > 0) {
                $.easyAjax({
                    url: "{{ route('lead-sources.reorder') }}",
                    type: "POST",
                    data: {
                        _token: "{{ csrf_token() }}",
                        sourceIds: sourceIds
                    },
                    success: function(response) {
                        if (response.status == "success") {
                            // Order updated successfully
                        }
                    },
                    error: function(response) {
                        // Reload or handle error
                        location.reload();
                    }
                });
            }
        }
    });
</script>
