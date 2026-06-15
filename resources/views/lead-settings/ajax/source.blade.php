<div class="table-responsive p-20">
    <x-table class="table-bordered">
        <x-slot name="thead">
            <th>#</th>
            <th>@lang('app.name')</th>
            <th class="text-right">@lang('app.action')</th>
        </x-slot>

        @forelse($leadSources as $key => $source)
            <tr class="row{{ $source->id }} item-row" data-row-id="{{ $source->id }}">
                <td><i class="fa fa-arrows-alt text-muted mr-2" style="cursor: move;"></i> <span class="row-number">{{ ($key+1) }}</span></td>
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
    </x-table>
</div>

<script>
    $(function() {
        $(".table tbody").sortable({
            items: "tr.item-row",
            update: function(event, ui) {
                let sourceIds = [];
                $('.table tbody tr.item-row').each(function() {
                    let id = $(this).data('row-id');
                    if (id) {
                        sourceIds.push(id);
                    }
                });

                $.easyAjax({
                    url: "{{ route('lead-sources.reorder') }}",
                    type: "POST",
                    data: {
                        _token: "{{ csrf_token() }}",
                        sourceIds: sourceIds
                    },
                    success: function(response) {
                        if (response.status == "success") {
                            // Update the numbering visually
                            $('.table tbody tr.item-row').each(function(index) {
                                $(this).find('.row-number').html(index + 1);
                            });
                        }
                    },
                    error: function(response) {
                        // Revert on failure
                        $(".table tbody").sortable("cancel");
                    }
                });
            }
        });
        $(".table tbody").disableSelection();
    });
</script>
