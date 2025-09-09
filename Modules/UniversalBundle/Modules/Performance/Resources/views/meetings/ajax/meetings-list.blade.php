<style>
    #listViewDiv .avatar-group {
        display: flex;
        align-items: center;
    }

    #listViewDiv  .avatar-group-item {
        margin-left: -10px;
        border: 2px solid #fff;
        border-radius: 50%;
        transition: transform 0.2s;
    }

    #listViewDiv  .avatar-group-item:hover {
        transform: translateY(-3px);
        z-index: 9;
    }

    #listViewDiv  .avatar-group-item img {
        width: 35px;
        height: 35px;
        border-radius: 50%;
        object-fit: cover;
    }

    #listViewDiv  .dropdown-menu {
        min-width: 150px;
        padding: 0;
    }

    #listViewDiv  .dropdown-item {
        padding: 10px 15px;
        font-size: 13px;
    }

    #listViewDiv  .dropdown-item:hover {
        background-color: #f8f9fa;
    }

    /* Enhanced Styling for Meeting Cards */
    #listViewDiv  .meeting-card {
        border-radius: 10px !important;
    }

    #listViewDiv  .meeting-card .card-body {
        padding: 15px;
    }

    #listViewDiv  .meeting-card .card-title {
        font-size: 16px;
        font-weight: 600;
        color: #2d3748;
    }

    #listViewDiv  .meeting-card .card-text {
        font-size: 14px;
        color: #4a5568;
    }

    #listViewDiv  #statusDiv .badge {
        font-size: 12px;
        padding: 6px 12px;
        font-weight: 500;
    }

    #listViewDiv  .meeting-card .dropdown-toggle {
        background: none;
        border: none;
        color: #718096;
    }

    #listViewDiv  .meeting-card .dropdown-toggle:hover {
        color: #2d3748;
    }

    #listViewDiv  .meeting-card .avatar-group {
        margin-left: 10px;
    }

    #listViewDiv  .meeting-card .avatar-group-item img {
        width: 30px;
        height: 30px;
    }

    /* Date Section Styling */
    .date-section {
        margin-bottom: 15px;
        padding: 15px;
        padding-bottom: 5px;
        border-radius: 10px;
        background-color: #f8f9fa;
    }

    .date-section h3 {
        font-size: 28px;
        font-weight: 600;
        color: #2d3748;
    }

    .date-section p {
        font-size: 14px;
        color: #718096;
    }

    #listViewDiv  .meeting-card {
        border-radius: 15px !important;
        margin-bottom: 15px;
        border: 1px solid ##f1f1f3;
        transition: box-shadow 0.3s ease, transform 0.3s ease;
    }

    #listViewDiv  .avatar-group-item:hover {
        transform: scale(1.1) rotate(5deg);
        z-index: 10;
    }

    #listViewDiv  .dropdown-item {
        padding: .25rem 1.5rem;
        font-size: 14px;
    }

    #listViewDiv  #dateDiv {
        width: 100px;
    }
</style>

<div class="d-flex flex-wrap">
    <div class="w-100">
        <!-- Status Tabs -->
        <div class="d-flex mb-4 bg-light-grey p-2 rounded border">
            <a href="javascript:;"
                class="d-flex align-items-center px-3 py-2 rounded @if ($activeTab == 'upcoming') bg-white border @endif"
                onclick="loadData('upcoming')">
                <i class="fa fa-calendar-alt mr-2 text-primary"></i>
                <span class="text-dark">@lang('app.upcoming')</span>
            </a>
            <a href="javascript:;"
                class="d-flex align-items-center px-3 py-2 ms-3 rounded @if ($activeTab == 'pending') bg-white border @endif"
                onclick="loadData('pending')">
                <i class="fa fa-clock mr-2 text-warning"></i>
                <span class="text-dark">@lang('app.pending')</span>
            </a>
            <a href="javascript:;"
                class="d-flex align-items-center px-3 py-2 ms-3 rounded @if ($activeTab == 'recurring') bg-white border @endif"
                onclick="loadData('recurring')">
                <i class="fa fa-sync mr-2 text-info"></i>
                <span class="text-dark">@lang('app.recurring')</span>
            </a>

            <a href="javascript:;"
                class="d-flex align-items-center px-3 py-2 ms-3 rounded @if ($activeTab == 'past') bg-white border @endif"
                onclick="loadData('past')">
                <i class="fa fa-history mr-2 text-secondary"></i>
                <span class="text-dark">@lang('performance::app.past')</span>
            </a>
            <a href="javascript:;"
                class="d-flex align-items-center px-3 py-2 ms-3 rounded-2 @if ($activeTab == 'cancelled') bg-white shadow-sm @endif"
                onclick="loadData('cancelled')">
                <i class="fa fa-times-circle mr-2 text-danger"></i>
                <span class="text-dark">@lang('app.cancelled')</span>
            </a>
        </div>
    </div>
</div>

<!-- Past meetings section -->
@if ($activeTab == 'pending' && $pastMonthMeetingsCount > 0)
    <div class="mt-1 mb-4 @if(count($meetings) <= 0) text-center @endif">
        <h4 class="mb-0 f-14 f-w-500 text-darkest-grey">
            <a class="mb-0 f-14 f-w-500" href="javascript:;" id="pastMonthMeetings">
                <span class="text-darkest-grey">{{ $pastMonthMeetingsCount }} @if ($pastMonthMeetingsCount > 1) @lang('performance::messages.viewPastMeetings') @else @lang('performance::messages.viewPastMeeting') @endif </span>
                @lang('performance::app.viewList')
            </a>
        </h4>
    </div>
@endif

@forelse($meetings as $date => $dateWiseMeetings)
    <!-- Month Section -->
    @if ($loop->first || \Carbon\Carbon::parse($date)->format('M') != \Carbon\Carbon::parse($prevDate ?? $date)->format('M'))
        <div class="mt-1 mb-4">
            <h4 class="mb-0 f-18 f-w-500 text-darkest-grey">{{ \Carbon\Carbon::parse($date)->format('F') }}</h4>
        </div>
    @endif

    <!-- Date Section -->
    <div class="date-section border" id="listViewDiv">
        <div class="d-flex">
            <!-- Date -->
            <div class="align-self-center text-center bg-white p-3 rounded border shadow-sm" id="dateDiv">
                <h3 class="mb-0 f-32 f-w-600 text-darkest-grey">{{ \Carbon\Carbon::parse($date)->format('d') }}</h3>
                <p class="mb-0 text-lightest f-16 f-w-500">{{ \Carbon\Carbon::parse($date)->format('D') }}</p>
            </div>
            <!-- Date wise meetings -->
            <div class="flex-grow-1 border-start ps-4">
                @foreach ($dateWiseMeetings as $meeting)
                    <div class="meeting-card bg-white border">
                        <div class="card-body">
                            <div class="row">
                                <div class="col-4">
                                    <!-- Meeting Time -->
                                    @if (($activeTab == 'upcoming' && $meeting->status == 'pending') || ($activeTab == 'recurring' && $meeting->status == 'pending' && $meeting->start_date_time > \Carbon\Carbon::now()->setTimezone(company()->timezone)))
                                        <div class="d-flex align-items-center mt-1">
                                            <div class="f-14 mb-0 mr-3 text-dark bg-grey p-1 rounded"><i class="fa fa-clock mr-1"></i> @lang('performance::modules.startOn'): {{ $meeting->start_date_time->translatedFormat(company()->time_format) }}
                                            </div>
                                        </div>
                                    @else
                                        <div class="d-inline-flex align-items-center mb-3 f-14 text-dark bg-grey p-1 rounded">
                                            <i class="fa fa-clock mr-1"></i>
                                            {{ $meeting->start_date_time->translatedFormat(company()->time_format) }} -
                                            {{ $meeting->end_date_time->translatedFormat(company()->time_format) }}
                                        </div>
                                    @endif

                                    <!-- Status -->
                                    @if (($activeTab == 'upcoming' && $meeting->status == 'pending') || ($activeTab == 'recurring' && $meeting->status == 'pending' && $meeting->start_date_time > \Carbon\Carbon::now()->setTimezone(company()->timezone)))
                                        <div class="d-flex align-items-center mt-4">
                                            <div class="f-14 mb-0 mr-3 text-dark bg-grey p-1 pr-2 rounded"><i class="fa fa-clock mr-1"></i> @lang('performance::modules.endOn'): {{ $meeting->end_date_time->translatedFormat(company()->time_format) }}
                                            </div>
                                        </div>
                                    @else
                                        <div class="d-flex align-items-center">
                                            <p class="card-text f-14 text-dark-grey" id="statusDiv">
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

                                <!-- Attendees -->
                                <div class="col-6">
                                    <div class="d-flex align-items-center">
                                        <div class="f-14 text-lightest mb-0 mr-3">@lang('performance::app.meetingFor'):</div>
                                        <div class="avatar-group">
                                            <x-employee :user="$meeting->meetingFor" />
                                        </div>
                                    </div>
                                    <div class="d-flex align-items-center mt-3">
                                        <div class="f-14 text-lightest mb-0 mr-3">@lang('performance::app.meetingBy'):</div>
                                        <div class="avatar-group">
                                            <x-employee :user="$meeting->meetingBy" />
                                        </div>
                                    </div>
                                </div>

                                <!-- Quick Actions -->
                                    <div class="col-2 text-right">
                                        <div class="dropdown">
                                            <button class="btn btn-lg f-14 p-0 text-lightest text-capitalize rounded"
                                                type="button" data-toggle="dropdown" aria-haspopup="true"
                                                aria-expanded="false">
                                                <i class="fa fa-ellipsis-h"></i>
                                            </button>
                                            <div class="dropdown-menu dropdown-menu-right border-grey rounded b-shadow-4 p-0"
                                                aria-labelledby="dropdownMenuLink" tabindex="0">
                                                <a class="dropdown-item openRightModal"
                                                    href="{{ route('meetings.show', $meeting->id) }}?tab=list">
                                                    <i class="fa fa-eye mr-2"></i>@lang('app.view') @lang('performance::app.meeting')
                                                </a>

                                                @if ($meeting->status == 'pending' && \Carbon\Carbon::parse($meeting->start_date_time)->format('Y-m-d H:i:s') < \Carbon\Carbon::now()->setTimezone(company()->timezone)->format('Y-m-d H:i:s'))
                                                    <a class="dropdown-item sendReminder" data-meeting-id="{{ $meeting->id }}" href="javascript:;">
                                                        <i class="fa fa-paper-plane mr-2"></i>@lang('modules.accountSettings.sendReminder')
                                                    </a>
                                                @endif
                                            </div>
                                        </div>
                                    </div>
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>
        </div>
    </div>
    @php
        $prevDate = $date;
    @endphp
@empty
    <div class="align-self-center text-center p-5">
        <i class="fa fa-calendar-times fa-4x text-lightest mb-2"></i>
        <p class="mb-0 f-15 text-lightest">@lang('messages.noRecordFound')</p>
    </div>
@endforelse
