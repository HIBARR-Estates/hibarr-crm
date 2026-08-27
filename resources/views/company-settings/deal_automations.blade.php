@extends('layouts.app')

@section('content')

    <!-- SETTINGS START -->
    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        @lang($pageTitle)
                    </h2>
                </div>
            </x-slot>

            <x-slot name="action">
                <div class="row">
                    <div class="col-md-12 text-right">
                        <x-forms.link-primary :link="route('deal-automations.create')" icon="plus" class="mb-2 mr-3">
                            @lang('app.addNew')
                        </x-forms.link-primary>
                    </div>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
                <div class="table-responsive">
                    <table class="table table-bordered table-hover">
                        <thead>
                            <tr>
                                <th>Priority</th>
                                <th>Automation Name</th>
                                <th>For</th>
                                <th>Scope & Trigger</th>
                                <th>Actions (Result)</th>
                                <th>Status</th>
                                <th class="text-right">@lang('app.action')</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($automations as $automation)
                                <tr>
                                    <td>{{ $automation->priority }}</td>
                                    <td>
                                        <h5 class="mb-0 f-14 text-darkest-grey">{{ $automation->name }}</h5>
                                    </td>
                                    <td>
                                        @if(($automation->subject_type ?? 'deal') === 'lead')
                                            <span class="badge badge-info">Leads</span>
                                        @else
                                            <span class="badge badge-primary">Deals</span>
                                        @endif
                                    </td>
                                    <td>
                                        <div class="d-flex flex-column">
                                            @if(($automation->subject_type ?? 'deal') === 'lead')
                                                <span class="badge badge-light mb-1">All Leads</span>
                                            @else
                                                <span class="badge badge-light mb-1">{{ $automation->pipeline->name ?? 'All Pipelines' }}</span>
                                            @endif
                                            <small class="text-muted">When: {{ ucwords(str_replace('_', ' ', $automation->trigger ?? 'Any Update')) }}</small>
                                            @if($automation->wait_duration_value)
                                                <small class="text-muted">Wait: {{ $automation->wait_duration_value }} {{ strtolower($automation->wait_duration_unit ?? 'days') }}</small>
                                            @endif
                                        </div>
                                    </td>
                                    <td>
                                        @foreach($automation->actions as $action)
                                            <div class="mb-1">
                                                @if(($action->action_type ?? 'stage_transition') === 'stage_transition')
                                                    <i class="fa fa-arrow-right text-lightest"></i>
                                                    Move to <strong>{{ $action->targetStage->name ?? 'Unknown Stage' }}</strong>
                                                    @if($action->targetPipeline)
                                                        in {{ $action->targetPipeline->name }}
                                                    @endif
                                                @elseif($action->action_type === 'set_field_value')
                                                    <i class="fa fa-edit text-primary"></i>
                                                    Set <strong>{{ ucwords(str_replace('_', ' ', $action->field_name)) }}</strong>
                                                    = <code>{{ $action->field_value }}</code>
                                                @elseif($action->action_type === 'lock_deal')
                                                    <i class="fa fa-lock text-warning"></i>
                                                    <strong>Lock Deal</strong>
                                                @elseif($action->action_type === 'send_email')
                                                    <i class="fa fa-envelope text-primary"></i>
                                                    Send email <strong>{{ $action->emailTemplate->name ?? 'Unknown Template' }}</strong>
                                                    <br><small class="text-muted">to: {{ collect($action->recipient_types ?: ['client'])->map(fn($t) => \App\Services\AutomationFieldCatalog::RECIPIENT_TYPES[$t]['label'] ?? $t)->implode(', ') }}</small>
                                                @elseif($action->action_type === 'create_task')
                                                    <i class="fa fa-check-square text-primary"></i>
                                                    Create task <strong>{{ $action->title ?: 'Automated Task' }}</strong>
                                                    (assign: {{ $action->assignee_type === 'specific_user' ? ($action->assigneeUser->name ?? 'Unknown User') : (\App\Services\AutomationFieldCatalog::ASSIGNMENT_TYPES[$action->assignee_type]['label'] ?? $action->assignee_type ?? 'Lead Owner') }})
                                                @elseif($action->action_type === 'create_note')
                                                    <i class="fa fa-sticky-note text-primary"></i>
                                                    Create note
                                                    @if($action->title)
                                                        <strong>{{ $action->title }}</strong>
                                                    @endif
                                                @endif
                                            </div>
                                        @endforeach
                                    </td>
                                    <td>
                                        <div class="custom-control custom-switch">
                                            <input type="checkbox" class="custom-control-input change-automation-status"
                                                id="status-{{ $automation->id }}"
                                                data-automation-id="{{ $automation->id }}"
                                                {{ $automation->active ? 'checked' : '' }}>
                                            <label class="custom-control-label cursor-pointer" for="status-{{ $automation->id }}"></label>
                                        </div>
                                    </td>
                                    <td class="text-right">
                                        <div class="task_view">
                                            <a href="{{ route('deal-automations.edit', $automation->id) }}" class="task_view_more d-flex align-items-center justify-content-center">
                                                <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="7">
                                        <x-cards.no-record icon="list" :message="__('messages.noRecordFound')" />
                                    </td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>

        </x-setting-card>

    </div>
    <!-- SETTINGS END -->
@endsection

@push('scripts')
    <script>
        $('body').on('change', '.change-automation-status', function() {
            var id = $(this).data('automation-id');
            var status = $(this).is(':checked') ? 'active' : 'inactive';
            var url = "{{ route('deal-automations.change-status') }}";
            var token = "{{ csrf_token() }}";

            $.easyAjax({
                url: url,
                type: "POST",
                data: {
                    '_token': token,
                    'id': id,
                    'status': status
                },
                success: function(response) {
                    //
                }
            })
        });
    </script>
@endpush
