<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    <div class="table-responsive">
        <x-table class="table-bordered">
            <x-slot name="thead">
                <th>@lang('performance::modules.metricsName')</th>
                <th class="text-right">@lang('app.action')</th>
            </x-slot>

            @forelse($KeyResultsMetrics as $key => $metrics)
            <tr id="metrics-{{ $metrics->id }}">
                <td>{{ $metrics->name }}</td>
                <td class="text-right">
                    <div class="task_view">
                        <a href="javascript:;" data-metrics-type-id="{{ $metrics->id }}"
                            class="edit-key-results task_view_more d-flex align-items-center justify-content-center">
                            <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                        </a>
                    </div>
                    <div class="task_view">
                        <a href="javascript:;" data-metrics-type-id="{{ $metrics->id }}"
                            class="delete-key-results task_view_more d-flex align-items-center justify-content-center">
                            <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')
                        </a>
                    </div>
                </td>
            </tr>
            @empty
            <tr>
                <td colspan="4">
                    <x-cards.no-record icon="list" :message="__('performance::messages.noKeyResultsMetrics')" />
                </td>
            </tr>
            @endforelse
        </x-table>
    </div>
</div>
