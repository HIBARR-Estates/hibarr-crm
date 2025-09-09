<style>
    .role-list {
        list-style-type: none;
        padding-left: 0;
    }

</style>
<div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
    <div class="table-responsive">
        <x-table class="table-bordered">
            <x-slot name="thead">
                <th>@lang('app.type')</th>
                <th>@lang('performance::modules.viewedBy')</th>
                <th>@lang('performance::modules.managedBy')</th>
                <th class="text-right">@lang('app.action')</th>
            </x-slot>

            @forelse($goalTypes as $key => $type)
            <tr id="type-{{ $type->id }}">
                <td>{{ __('performance::app.' . $type->type) }}</td>
                <td>
                    @if (!empty($type->view_by_roles_names))
                        <ul class="role-list">
                            @foreach ($type->view_by_roles_names as $roleName)
                                <li>{{ $roleName }}</li>
                            @endforeach
                        </ul>
                    @else
                        --
                    @endif
                </td>
                <td>
                    @if (!empty($type->manage_by_roles_names))
                        <ul class="role-list">
                            @foreach ($type->manage_by_roles_names as $roleName)
                                <li>{{ $roleName }}</li>
                            @endforeach
                        </ul>
                    @else
                        --
                    @endif
                </td>
                <td class="text-right">
                    <div class="task_view">
                        <a href="javascript:;" data-goal-type-id="{{ $type->id }}"
                            class="edit-goal-type task_view_more d-flex align-items-center justify-content-center">
                            <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                        </a>
                    </div>
                </td>
            </tr>
            @empty
            <tr>
                <td colspan="4">
                    <x-cards.no-record icon="list" :message="__('performance::messages.noGoalTypeSettingsAdded')" />
                </td>
            </tr>
            @endforelse
        </x-table>
    </div>
</div>
