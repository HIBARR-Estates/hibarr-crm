@php
    $moveClass = '';
@endphp
@if ($draggable == 'false')
    @php
        $moveClass = 'move-disable';
    @endphp
@endif

<div class="card bg-white border-grey m-1 mx-3 mb-2 {{ $moveClass }} task-card" data-task-id="{{ $lead->id }}"
    id="drag-task-{{ $lead->id }}" style="border-radius: 0.75rem !important">
    <div class="card-body flex flex-col gap-2">
        <div class="flex flex-col gap-1">
            <div class="d-flex justify-content-between">
                <a href="{{ route('deals.show', [$lead->id]) }}"
                    class="text-base font-medium text-dark mb-0 text-wrap openRightModal">{{ $lead->name }}
                    @if (!is_null($lead->contact->client_id))
                        <i class="fa fa-check-circle text-success" data-toggle="tooltip"
                            data-original-title="@lang('modules.lead.convertedClient')"></i>
                    @endif
                </a>
            </div>

            @if ($lead->contact->client_name)
                <div class="d-flex align-items-center">
                    <span class="text-xs font-normal text-dark-grey">{{ $lead->contact->client_name_salutation }}</span>
                </div>
            @endif


            @if (!is_null($lead->value))
                <div class="flex justify-between items-center">
                    <div class="flex items-center">
                        <i class="bi bi-cash-stack text-dark-grey"></i>
                        <span
                            class="f-12 text-dark-grey ml-1">{{ currency_format($lead->value, $lead->currency_id) }}</span>
                    </div>
                </div>
            @endif
        </div>

        {{-- @if (($lead->next_follow_up_date != null && $lead->next_follow_up_date != '') || !is_null($lead->agent_id)) --}}
        <hr class="my-0">
        <div class="d-flex justify-content-between align-items-center">
            @if ($lead->next_follow_up_date != null && $lead->next_follow_up_date != '')
                <div class="d-flex text-lightest">
                    <span class="f-12 ml-1"><i class="f-11 bi bi-calendar"></i>
                        {{ \Carbon\Carbon::parse($lead->next_follow_up_date)->translatedFormat(company()->date_format) }}</span>
                </div>
            @endif
            @if (!is_null($lead->agent_id))
                <a href="{{ route('employees.show', $lead->leadAgent->user_id) }}" class="ml-auto">
                    <div class="d-flex flex-wrap items-center gap-1">
                        <span class="text-xs font-normal text-dark-grey">{{ $lead->leadAgent->user->name }}</span>
                        <div class="avatar-img ml-1 rounded-circle" style="width: 24px; height: 24px;">
                            <div alt="{{ $lead->leadAgent->user->name }}" data-toggle="tooltip"
                                data-original-title="{{ __('app.leadAgent') . ' : ' . $lead->leadAgent->user->name }}"
                                data-placement="right">
                                <img src="{{ $lead->leadAgent->user->image_url }}">
                            </div>
                        </div>
                    </div>
                </a>
            @else
                <a href="{{ route('deals.edit', [$lead->id]) }}"
                    class="text-xs ml-auto font-medium text-dark mb-0 text-wrap openRightModal">
                    @lang('modules.deal.assignAgent')
                </a>
            @endif
        </div>
        {{-- @endif --}}
    </div>
</div><!-- div end -->
