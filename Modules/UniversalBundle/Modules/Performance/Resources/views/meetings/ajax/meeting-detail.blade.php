<!-- TAB CONTENT START -->
<div class="tab-pane fade show active" role="tabpanel" aria-labelledby="detail">
    <div class="d-flex flex-wrap justify-content-between p-20" id="detail">
        <div class="card w-100 rounded-0 border-0 note">
            <div class="card-horizontal">
                <div class="card-body border-0 pl-0 py-1">
                    <x-cards.data-row :label="__('performance::modules.startOn')" :value="$meeting->start_date_time->translatedFormat(company()->date_format. ' - '.company()->time_format)" html="true" />
                    <x-cards.data-row :label="__('performance::modules.endOn')" :value="$meeting->end_date_time->translatedFormat(company()->date_format. ' - '.company()->time_format)" html="true" />

                    <div class="col-12 px-0 pb-3 d-flex">
                        <p class="mb-0 text-lightest f-14 w-30 d-inline-block ">
                        @lang('performance::app.meetingFor')</p>
                        <p class="mb-0 text-dark-grey f-14">
                            <x-employee :user="$meeting->meetingFor" />
                        </p>
                    </div>

                    <div class="col-12 px-0 pb-3 d-flex">
                        <p class="mb-0 text-lightest f-14 w-30 d-inline-block ">
                        @lang('performance::app.meetingBy')</p>
                        <p class="mb-0 text-dark-grey f-14">
                            <x-employee :user="$meeting->meetingBy" />
                        </p>
                    </div>

                    <div class="col-12 px-0 pb-3 d-flex">
                        <p class="mb-0 text-lightest f-14 w-30 d-inline-block ">
                        @lang('performance::app.goal')</p>
                            <p class="mb-0 text-dark-grey f-14">
                                @if ($meeting->goal)
                                    <a href="{{ route('objectives.show', $meeting->goal->id) }}" class="text-blue openRightModal"> {{ $meeting->goal->title }}</a>
                                @else
                                    --
                                @endif
                            </p>
                    </div>

                    @if ($meeting->status)
                        <div class="col-12 px-0 pb-3 d-lg-flex d-md-flex d-block">
                            <p class="mb-0 text-lightest f-14 w-30 ">@lang('app.status')</p>
                            <p class="card-text f-14 text-dark-grey">
                                @if ($meeting->status == 'pending')
                                    <span class="badge badge-warning mt-3">
                                        {{ ucfirst(__('performance::app.' . $meeting->status)) ?? __('performance::app.pending') }}
                                    </span>
                                @elseif($meeting->status == 'completed')
                                    <span class="badge badge-success mt-3">
                                        {{ ucfirst(__('performance::app.' . $meeting->status)) ?? __('performance::app.pending') }}
                                    </span>
                                @elseif($meeting->status == 'cancelled')
                                    <span class="badge badge-danger mt-3">
                                        {{ ucfirst(__('performance::app.' . $meeting->status)) ?? __('performance::app.pending') }}
                                    </span>
                                @else
                                    <span class="badge badge-warning mt-3">
                                        {{ ucfirst(__('performance::app.' . $meeting->status)) ?? '--' }}
                                    </span>
                                @endif
                            </p>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>
<!-- TAB CONTENT END -->
