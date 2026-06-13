<div class="p-20">
    <div class="alert alert-info mb-4">
        @lang('modules.lead.lifecycleStatusHelp')
    </div>

    <div class="table-responsive">
        <x-table class="table-bordered">
            <x-slot name="thead">
                <th>#</th>
                <th>@lang('app.status')</th>
                <th>@lang('modules.lead.lifecycleStatusKey')</th>
                <th>@lang('app.description')</th>
                <th>@lang('modules.lead.leadsUsingStatus')</th>
                <th>@lang('modules.tasks.position')</th>
                <th class="text-right">@lang('app.action')</th>
            </x-slot>

            @forelse($leadLifecycleStatuses as $key => $status)
                <tr class="row{{ $status->id }}">
                    <td>{{ $key + 1 }}</td>
                    <td>
                        <span class="badge f-12" style="background-color: {{ $status->label_color }}; color: #fff;">
                            {{ $status->label }}
                        </span>
                        @if($status->isDefaultForNewLeads())
                            <span class="badge badge-secondary f-11 ml-1">@lang('app.default')</span>
                        @endif
                    </td>
                    <td>
                        <code>{{ $status->key }}</code>
                    </td>
                    <td>{{ $status->description ?: '—' }}</td>
                    <td>
                        <span class="f-14">{{ $status->leads_count }}</span>
                        @if($status->leads_count > 0)
                            <span class="text-muted f-11 d-block">@lang('modules.lead.lifecycleStatusInUse')</span>
                        @endif
                    </td>
                    <td>{{ $status->sort_order }}</td>
                    <td class="text-right">
                        <div class="task_view">
                            <a href="javascript:;"
                                data-lifecycle-status-id="{{ $status->id }}"
                                class="edit-lifecycle-status task_view_more d-flex align-items-center justify-content-center">
                                <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                            </a>
                        </div>
                        @if(!$status->isSystemKey() && $status->leads_count === 0)
                            <div class="task_view mt-1 mt-lg-0 mt-md-0">
                                <a href="javascript:;"
                                    data-lifecycle-status-id="{{ $status->id }}"
                                    class="delete-lifecycle-status task_view_more d-flex align-items-center justify-content-center">
                                    <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')
                                </a>
                            </div>
                        @endif
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="7">
                        <x-cards.no-record icon="list" :message="__('modules.lead.noLifecycleStatuses')" />
                    </td>
                </tr>
            @endforelse
        </x-table>
    </div>
</div>
