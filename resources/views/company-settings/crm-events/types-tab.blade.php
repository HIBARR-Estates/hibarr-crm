{{-- Event Types Tab Content --}}
<div class="row mb-3">
    <div class="col-md-12 text-right">
        <x-forms.link-primary :link="route('crm-event-types.create')" icon="plus" class="mb-2">
            @lang('app.addNew')
        </x-forms.link-primary>
    </div>
</div>

<div class="table-responsive">
    <table class="table table-bordered table-hover">
        <thead class="thead-light">
            <tr>
                <th>@lang('app.name')</th>
                <th>Slug</th>
                <th>Category</th>
                <th>Model</th>
                <th class="text-center">Processing</th>
                <th class="text-center">@lang('app.status')</th>
                <th class="text-right">@lang('app.action')</th>
            </tr>
        </thead>
        <tbody>
            @forelse($eventTypes as $eventType)
                <tr>
                    <td>
                        <h5 class="mb-0 f-14 text-darkest-grey">
                            {{ $eventType->name }}
                            @if($eventType->is_system)
                                <i class="fa fa-lock f-11 text-lightest ml-1" data-toggle="tooltip"
                                   title="System-managed"></i>
                            @endif
                        </h5>
                        @if($eventType->description)
                            <small class="text-muted f-11">{{ Str::limit($eventType->description, 50) }}</small>
                        @endif
                    </td>
                    <td><code class="f-12">{{ $eventType->slug }}</code></td>
                    <td>
                        @if($eventType->category)
                            <span class="badge badge-secondary">{{ $eventType->category->name }}</span>
                        @else
                            <span class="text-lightest">—</span>
                        @endif
                    </td>
                    <td>
                        @if($eventType->model_type)
                            <code class="f-11">{{ class_basename($eventType->model_type) }}</code>
                        @else
                            <span class="text-lightest">—</span>
                        @endif
                    </td>
                    <td class="text-center">
                        @if($eventType->sync_processing)
                            <span class="badge badge-warning f-10">Sync</span>
                        @else
                            <span class="badge badge-success f-10">Async</span>
                        @endif
                    </td>
                    <td class="text-center">
                        <div class="custom-control custom-switch">
                            <input type="checkbox"
                                   class="custom-control-input crm-event-status-toggle"
                                   id="type-status-{{ $eventType->id }}"
                                   data-entity-type="type"
                                   data-entity-id="{{ $eventType->id }}"
                                   {{ $eventType->is_active ? 'checked' : '' }}>
                            <label class="custom-control-label cursor-pointer"
                                   for="type-status-{{ $eventType->id }}"></label>
                        </div>
                    </td>
                    <td class="text-right">
                        <div class="task_view d-flex justify-content-end">
                            <a href="{{ route('crm-event-types.edit', $eventType->id) }}"
                               class="task_view_more d-flex align-items-center justify-content-center mr-2">
                                <i class="fa fa-edit icons mr-1"></i> @lang('app.edit')
                            </a>
                            @if(!$eventType->is_system)
                                <a href="javascript:;"
                                   class="task_view_more d-flex align-items-center justify-content-center text-danger crm-event-delete"
                                   data-url="{{ route('crm-event-types.destroy', $eventType->id) }}">
                                    <i class="fa fa-trash-alt icons mr-1"></i> @lang('app.delete')
                                </a>
                            @endif
                        </div>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="7">
                        <x-cards.no-record icon="tags" :message="__('messages.noRecordFound')" />
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>
