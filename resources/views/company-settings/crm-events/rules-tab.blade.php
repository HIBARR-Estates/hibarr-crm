{{-- Business Rules Tab Content --}}
<div class="row mb-3">
    <div class="col-md-12 text-right">
        <x-forms.link-primary :link="route('crm-business-rules.create')" icon="plus" class="mb-2">
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
                <th>Description</th>
                <th class="text-center">Linked Event Types</th>
                <th class="text-center">@lang('app.status')</th>
                <th class="text-right">@lang('app.action')</th>
            </tr>
        </thead>
        <tbody>
            @forelse($businessRules as $rule)
                <tr>
                    <td>
                        <h5 class="mb-0 f-14 text-darkest-grey">{{ $rule->name }}</h5>
                    </td>
                    <td><code class="f-12">{{ $rule->slug }}</code></td>
                    <td class="f-13 text-dark-grey">{{ Str::limit($rule->description, 60) }}</td>
                    <td class="text-center">
                        <span class="badge badge-info">{{ $rule->event_types_count }}</span>
                    </td>
                    <td class="text-center">
                        <div class="custom-control custom-switch">
                            <input type="checkbox"
                                   class="custom-control-input crm-event-status-toggle"
                                   id="rule-status-{{ $rule->id }}"
                                   data-entity-type="rule"
                                   data-entity-id="{{ $rule->id }}"
                                   {{ $rule->is_active ? 'checked' : '' }}>
                            <label class="custom-control-label cursor-pointer"
                                   for="rule-status-{{ $rule->id }}"></label>
                        </div>
                    </td>
                    <td class="text-right">
                        <div class="task_view d-flex justify-content-end">
                            <a href="{{ route('crm-business-rules.edit', $rule->id) }}"
                               class="task_view_more d-flex align-items-center justify-content-center mr-2">
                                <i class="fa fa-edit icons mr-1"></i> @lang('app.edit')
                            </a>
                            @if($rule->event_types_count == 0)
                                <a href="javascript:;"
                                   class="task_view_more d-flex align-items-center justify-content-center text-danger crm-event-delete"
                                   data-url="{{ route('crm-business-rules.destroy', $rule->id) }}">
                                    <i class="fa fa-trash-alt icons mr-1"></i> @lang('app.delete')
                                </a>
                            @endif
                        </div>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6">
                        <x-cards.no-record icon="cogs" :message="__('messages.noRecordFound')" />
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>
</div>
