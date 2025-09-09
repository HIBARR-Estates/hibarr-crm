@push('styles')
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        #objective-detail-page .progress {
            height: 20px;
            border-radius: 10px;
            background-color: #f0f0f0;
        }

        #objective-detail-page .progress-bar {
            line-height: 30px;
            border-radius: 10px;
            transition: width 0.6s ease;
        }

        #objective-detail-page .down-arrow>a {
            display: block;
            position: relative;
        }

        #objective-detail-page .down-arrow>a:after {
            content: "\f078";
            /* f06e */
            /* fa-chevron-down */
            font-family: 'FontAwesome';
            position: absolute;
            right: 0;
        }

        #objective-detail-page .down-arrow>a[aria-expanded="true"]:after {
            content: "\f077";
            /* fa-chevron-up */
        }

        #objective-detail-page #view-objective-description {
            color: blue !important;
        }

        #objective-detail-page .view-key-description {
            color: blue !important;
        }

        #objective-detail-page .custom-hr {
            border: 1px solid #ccc;
            margin: 10px 0 20px 0;
        }

        #objective-detail-page .card-header {
            background-color: white;
        }

        #objective-detail-page .avatar-group {
            display: flex;
            align-items: center;
        }

        #objective-detail-page .avatar-group-item:hover {
            transform: translateY(-3px);
            z-index: 1;
        }

        #objective-detail-page .avatar-group-item img {
            border: 2px solid #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,.1);
        }

        #objective-detail-page .badge {
            font-weight: 500;
            padding: 0.5em 1em;
        }

        #objective-detail-page .badge-pill {
            border-radius: 20px;
        }

        #objective-detail-page .bg-light-grey {
            background-color: #f8f9fa;
        }

        #objective-detail-page .text-darkest-grey {
            color: #2e3338;
        }

        #objective-detail-page .font-weight-semibold {
            font-weight: 600;
        }

    </style>
@endpush

<div class="d-lg-flex" id="objective-detail-page">
    <div class="w-100 py-0 py-md-0">
        <!-- Action Button -->
        @if (!$managePermission)
            <div class="mb-4">
                <x-forms.link-primary :link="route('key-results.create', ['objectiveId' => $objective->id, 'currentUrl' => url()->current()])"
                    class="btn btn-primary  f-14  mr-3  openRightModal">
                    <i class="fa fa-plus-circle mr-1"></i> @lang('performance::app.addKeyResults')
                </x-forms.link-primary>
            </div>
        @endif

        <!-- Objective Overview Card -->
        <div class="row">
            <div class="col-md-12 mb-4">
                <div class="card border-0 rounded-lg shadow-sm">
                    <div class="card-body border rounded-lg p-4 bg-white">
                        <!-- Status and Progress Section -->
                        @if ($objective->status)
                            <div class="d-flex justify-content-between align-items-center mb-4">
                                <div class="d-flex align-items-center">
                                    <i class="fa fa-chart-line text-primary f-18 mr-2"></i>
                                    <span class="badge badge-{{ $objective->status->color }} px-3 py-2">
                                        {{ __('performance::app.' . $objective->status->status) }}
                                    </span>
                                </div>
                                <div class="progress-wrapper">
                                    <div class="d-flex align-items-center">
                                        <div class="progress flex-grow-1 mr-3" style="height: 8px; width: 200px;">
                                            <div class="progress-bar bg-{{ $objective->status->color == 'primary' ? 'primary-color-bar' : $objective->status->color }}"
                                                role="progressbar"
                                                style="width: {{ $objective->status->objective_progress }}%;"
                                                aria-valuenow="{{ $objective->status->objective_progress }}"
                                                aria-valuemin="0"
                                                aria-valuemax="100">
                                            </div>
                                        </div>
                                        <span class="font-weight-bold text-{{ $objective->status->color == 'primary' ? 'blue' : $objective->status->color }}">
                                            {{ $objective->status->objective_progress }}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        @endif

                        <!-- Objective Information Grid -->
                        <div class="row">
                            <!-- Added By -->
                            <div class="col-md-3 mb-4">
                                <div class="d-flex align-items-center">
                                    <div>
                                        <p class="text-muted mb-1 f-12">@lang('app.addedBy')</p>
                                        <div class="d-flex align-items-center">
                                            <x-employee :user="$objective->addedBy"/>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Owner -->
                            <div class="col-md-3 mb-4">
                                <div class="d-flex align-items-center">
                                    <div>
                                        <p class="text-muted mb-1 f-12">@lang('performance::app.owner')</p>
                                        <div class="avatar-group">
                                            @foreach ($objective->owners as $item)
                                                <div class="avatar-group-item">
                                                    <a href="{{ route('employees.show', $item->id) }}"
                                                        data-toggle="tooltip"
                                                        data-original-title="{{ $item->name }}">
                                                        <img src="{{ $item->image_url }}"
                                                            class="rounded-circle" width="30" height="30">
                                                    </a>
                                                </div>
                                            @endforeach
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Key Results Count -->
                            <div class="col-md-3 mb-4">
                                <div class="d-flex align-items-center">
                                    <div>
                                        <p class="text-muted mb-1 f-12">@lang('performance::app.totalKeyResults')</p>
                                        <h3 class="mb-0 f-18 text-primary">
                                            {{ count($objective->keyResults) }}
                                        </h3>
                                    </div>
                                </div>
                            </div>
                            <!-- Priority -->
                            <div class="col-md-3 mb-4">
                                <div class="d-flex align-items-center">
                                    <div>
                                        <p class="text-muted mb-1 f-12">@lang('performance::app.priority')</p>
                                        @if ($objective->priority)
                                            <span class="badge badge-pill
                                                {{ $objective->priority === 'high' ? 'badge-danger' : '' }}
                                                {{ $objective->priority === 'medium' ? 'badge-warning' : '' }}
                                                {{ $objective->priority === 'low' ? 'badge-success' : '' }}
                                                {{ !in_array($objective->priority, ['high', 'medium', 'low']) ? 'badge-primary' : '' }}">
                                                {{ __('performance::app.' . $objective->priority) }}
                                            </span>
                                        @else
                                            <span class="text-muted">--</span>
                                        @endif
                                    </div>
                                </div>
                            </div>

                            <!-- Check-in Frequency -->
                            <div class="col-md-3 mb-4">
                                <div class="d-flex align-items-center">
                                    <i class="fa fa-clock text-muted f-18 mr-2"></i>
                                    <div>
                                        <p class="text-muted mb-1 f-12">@lang('performance::app.checkInFrequency')</p>
                                        <span class="badge badge-secondary">
                                            {{ $objective->check_in_frequency ? __('app.' . $objective->check_in_frequency) : '--' }}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Date Range -->
                            <div class="col-md-3 mb-4">
                                <div class="d-flex align-items-center">
                                    <i class="fa fa-calendar text-muted f-18 mr-2"></i>
                                    <div>
                                        <p class="text-muted mb-1 f-12">@lang('app.date')</p>
                                        <h6 class="mb-0 f-14">
                                            {{ \Carbon\Carbon::parse($objective->start_date)->translatedFormat(company()->date_format) }} -
                                            {{ \Carbon\Carbon::parse($objective->end_date)->translatedFormat(company()->date_format) }}
                                        </h6>
                                    </div>
                                </div>
                            </div>

                        @if ($objective->project_id)
                        <div class="col-3 col-md-2 mb-3">
                            <h5 class="text-dark-grey f-14 font-weight-normal">@lang('app.project')</h5>
                            <p class="f-15 mb-0"><a href="{{ route('projects.show', $objective->project->id) }}" class="text-darkest-grey">{{ $objective->project->project_name }}</a></p>
                        </div>
                        @endif


                            <!-- Description -->
                            <div class="col-md-12">
                                <div class="d-flex">
                                    <i class="fa fa-align-left text-muted f-18 mr-2 mt-1"></i>
                                    <div>
                                        <p class="text-muted mb-1 f-12">@lang('app.description')</p>
                                        @if(strlen($objective->description) > 500)
                                            <p class="f-14 text-dark-grey">
                                                {!! nl2br(Illuminate\Support\Str::limit($objective->description, 500, '...')) !!}
                                                <a href="javascript:;" data-objective-id="{{ $objective->id }}"
                                                    class="text-primary" id="view-objective-description">
                                                    @lang('performance::app.viewMore')
                                                </a>
                                            </p>
                                        @else
                                            <p class="f-14 text-dark-grey">{!! !empty($objective->description) ? nl2br($objective->description) : '--' !!}</p>
                                        @endif
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Key Results Section -->
        @forelse ($objective->keyResults as $key => $keyResult)
        <div id="accordion-{{$key}}" class="mb-4">
            <div class="card bg-white">
                @if ($key == 0 )
                    <x-cards.data otherClasses="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <h5 class="key-results-header">
                                @lang('performance::app.keyResults')
                            </h5>
                        </div>
                    </x-cards.data>
                @endif

                <div class="card-header bg-white border" id="heading-{{$key}}">
                    <div class="row w-100">
                        <div class="col-12 mb-4 d-flex justify-content-between align-items-end">
                            <div class="col-md-10 ml-0 pl-0">
                                <h6 class="text-left">
                                    {{ $key + 1 }}. {{$keyResult->title}}
                                </h6>
                            </div>
                            <div class="col-md-2 text-right mr-0 pr-0 down-arrow">
                                <a role="button" data-toggle="collapse" href="#collapse-{{$key}}" aria-expanded="false" aria-controls="collapse-{{$key}}">
                                    <span class="mr-3 f-16 text-darkest-grey">@lang('performance::app.viewCheckIns')</span>
                                </a>
                            </div>
                        </div>

                        <div class="col-2 col-md-2">
                            <h5 class="text-lightest mb-3 f -14 font-weight-normal">@lang('app.description')</h5>
                            @if(strlen($keyResult->description) > 100)
                                <p class="text-dark-grey f-15 d-inline">
                                    {!! nl2br(Illuminate\Support\Str::limit($keyResult->description, 100, '...')) !!}
                                    <a href="javascript:;" data-key-id="{{ $keyResult->id }}"
                                        class="text-primary d-inline view-key-description">
                                        @lang('performance::app.viewMore')
                                    </a>
                                </p>
                            @else
                                <p class="text-dark-grey f-14">{!! !empty($keyResult->description) ? nl2br($keyResult->description) : '--' !!}</p>
                            @endif
                        </div>

                        <div class="col-1 col-md-1">
                            <h5 class="text-lightest f-14 font-weight-normal">@lang('performance::app.totalCheckIns')</h5>
                            <p class="text-dark-grey f-14" id="ownerDiv">
                                {{ count($keyResult->checkIns) }}
                            </p>
                        </div>

                        <div class="@if ($keyResult->key_percentage < 100) col-2 col-md-2 @else col-3 col-md-3 @endif">

                            <h5 class="text-uppercase mb-3 f-14 text-darkest-grey font-weight-bold">
                                @lang('performance::app.values')
                            </h5>

                            <div class="value-item mb-2 d-flex align-items-center justify-content-between">
                                <label class="f-12 text-muted mb-1">@lang('performance::app.initialValue')</label>
                                <div class="d-flex align-items-center">
                                    <i class="fa fa-circle f-8 mr-2 text-primary"></i>
                                    <span class="f-14 font-weight-semibold">
                                        {{ $keyResult->original_current_value !== null ?
                                            number_format((float) $keyResult->original_current_value, 2) : '--' }}
                                    </span>
                                </div>
                            </div>

                            <div class="value-item mb-2 d-flex align-items-center justify-content-between">
                                <label class="f-12 text-muted mb-1">@lang('performance::app.currentValue')</label>
                                <div class="d-flex align-items-center">
                                    <i class="fa fa-circle f-8 mr-2 text-success"></i>
                                    <span class="f-14 font-weight-semibold">
                                        {{ $keyResult->current_value !== null ?
                                            number_format((float) $keyResult->current_value, 2) : '--' }}
                                    </span>
                                </div>
                            </div>

                            <div class="value-item d-flex align-items-center justify-content-between">
                                <label class="f-12 text-muted mb-1">@lang('performance::app.targetValue')</label>
                                <div class="d-flex align-items-center">
                                    <i class="fa fa-circle f-8 mr-2 text-warning"></i>
                                    <span class="f-14 font-weight-semibold">
                                        {{ $keyResult->target_value !== null ?
                                            number_format((float) $keyResult->target_value, 2) : '--' }}
                                    </span>
                                </div>
                            </div>

                        </div>
                        <div class="col-2 col-md-2">
                            <h5 class="text-lightest mb-3 f-14 font-weight-normal">@lang('app.progress')</h5>
                            <div class="progress">
                                <div class="progress-bar bg-primary" role="progressbar"
                                    style="width: {{ $keyResult->key_percentage }}%;"
                                    aria-valuenow="{{ $keyResult->key_percentage }}"
                                    aria-valuemin="0"
                                    aria-valuemax="100">
                                    {{ $keyResult->key_percentage }}%
                                </div>
                            </div>
                        </div>
                        <div class="col-1 col-md-1">
                            <h5 class="text-lightest mb-3 f-14 font-weight-normal">@lang('app.added') @lang('app.on')</h5>
                            <p class="mb-0 text-dark-grey f-14">{{ $keyResult->created_at ? \Carbon\Carbon::parse($keyResult->created_at)->translatedFormat(company()->date_format) : '--'}}</p>
                        </div>

                        <div class="col-1 col-md-1">
                            <h5 class="text-lightest mb-3 f-14 font-weight-normal">@lang('performance::app.lastCheckIn')</h5>
                            <p class="mb-0 text-dark-grey f-14">
                                {{ $keyResult->last_check_in ? \Carbon\Carbon::parse($keyResult->last_check_in)->translatedFormat(company()->date_format) : '--'}}
                            </p>
                        </div>
                        @if ($keyResult->key_percentage < 100)
                            <div class="col-1 col-md-1">
                                <h5 class="text-lightest mb-3 f-14 font-weight-normal">@lang('performance::app.nextCheckIn')</h5>
                                <p class="mb-0 text-dark-grey f-14">
                                    {{ $keyResult->next_check_in ? \Carbon\Carbon::parse($keyResult->next_check_in)->translatedFormat(company()->date_format) : '--'}}

                                    @if ($keyResult->next_check_in && \Carbon\Carbon::parse($keyResult->next_check_in)->format('Y-m-d') <= \Carbon\Carbon::now()->format('Y-m-d'))
                                        <span class="badge badge-warning">@lang('app.pending')</span>
                                    @endif
                                </p>
                            </div>
                        @endif

                        @if (!$managePermission)
                            <div class="col-2 col-md-2 check-in-btn text-right mt-3">
                                <div class="task_view mb-3">
                                    <a href="javascript:;" data-key-id="{{ $keyResult->id }}"
                                        class="add-check-in task_view_more d-flex align-items-center justify-content-center btn btn-primary rounded f-14 p-2 float-left">
                                        <i class="fa fa-check icons mr-2"></i> @lang('performance::app.checkIn')
                                    </a>
                                </div>

                                @if ($keyResult->next_check_in && \Carbon\Carbon::parse($keyResult->next_check_in)->format('Y-m-d') <= \Carbon\Carbon::now()->format('Y-m-d'))
                                <br>
                                    <a href="javascript:;" class="text-secondary btn btn-sm f-14 sendReminder" data-toggle="tooltip"
                                        data-key-id="{{ $keyResult->id }}"
                                        data-original-title="@lang('modules.accountSettings.sendReminder')">
                                        <i class="fa fa-paper-plane mr-2"></i> @lang('modules.accountSettings.sendReminder')
                                    </a>
                                @endif
                            </div>
                        @endif
                    </div>
                </div>

                <div id="collapse-{{$key}}" class="collapse" data-parent="#accordion-{{$key}}" aria-labelledby="heading-{{$key}}">
                    @if (count($keyResult->checkIns) > 0)
                        <div class="card-body">
                            @foreach ($keyResult->checkIns as $check => $checkIn)
                            <div id="accordion-{{$key}}-{{$check}}"  class="mb-4">
                                <div class="card">
                                    @if ($check == 0)
                                        <x-cards.data otherClasses="d-flex justify-content-between align-items-center">
                                            <div class="d-flex align-items-center">
                                                <h5 class="key-results-header">
                                                    @lang('performance::app.checkInDetails')
                                                </h5>
                                            </div>
                                        </x-cards.data>
                                    @endif
                                    <div class="card-header bg-white border" id="heading-{{$key}}-{{$check}}">
                                        <div class="row w-100">
                                            <div class="col-12">
                                                <h4 class="down-arrow">
                                                    <a class="collapsed pb-4" role="button" data-toggle="collapse" href="#collapse-{{$key}}-{{$check}}" aria-expanded="false" aria-controls="collapse-{{$key}}-{{$check}}">
                                                        <div class="row w-100">
                                                            <div class="col-3 col-md-3">
                                                                <h5 class="text-lightest f-14 font-weight-normal">@lang('performance::app.checkIn') @lang('app.value')</h5>
                                                            </div>
                                                            <div class="col-3 col-md-3 ml-0 pl-1">
                                                                <h5 class="text-lightest f-14 font-weight-normal ml-0 pl-0">@lang('performance::app.confidenceLevel')</h5>
                                                            </div>
                                                            <div class="col-3 col-md-3">
                                                                <h5 class="text-lightest f-14 font-weight-normal ml-3">@lang('performance::app.checkInDate')</h5>
                                                            </div>
                                                            <div class="col-3 col-md-3">
                                                                <h5 class="text-lightest f-14 font-weight-normal">@lang('performance::app.checkInBy')</h5>
                                                            </div>
                                                        </div>
                                                    </a>
                                                </h4>
                                            </div>
                                        </div>
                                        <div class="row w-100 text-left">
                                            <div class="col-12 col-md-12">
                                                <div class="row">
                                                    <div class="col-3 col-md-3">
                                                        <p class="mb-0 text-dark-grey f-14">{{ $checkIn->current_value }}</p>
                                                    </div>
                                                    <div class="col-3 col-md-3 ml-0 pl-0 pr-0 mr-0">
                                                        <p class="mb-0 text-dark-grey f-14 ml-0 pl-0">
                                                            @if($checkIn->confidence_level)
                                                                <span class="badge
                                                                    {{ $checkIn->confidence_level === 'high' ? 'badge-danger' : '' }}
                                                                    {{ $checkIn->confidence_level === 'medium' ? 'badge-warning' : '' }}
                                                                    {{ $checkIn->confidence_level === 'low' ? 'badge-success' : '' }}
                                                                    {{ !in_array($checkIn->confidence_level, ['high', 'medium', 'low']) ? 'badge-primary' : '' }}">
                                                                    {{ __('performance::app.' . $checkIn->confidence_level) }}
                                                                </span>
                                                            @else
                                                                {{ '--' }}
                                                            @endif
                                                        </p>
                                                    </div>
                                                    <div class="col-3 col-md-3">
                                                        <p class="text-dark-grey f-14 ml-1">{{ $checkIn->check_in_date ? \Carbon\Carbon::parse($checkIn->check_in_date)->translatedFormat(company()->date_format) : '--' }}</p>
                                                    </div>
                                                    <div class="col-3 col-md-3 ml-0 pl-0 mb-0">
                                                        <p class="text-dark-grey f-14">
                                                            <x-employee :user="$checkIn->checkInBy"/>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div id="collapse-{{$key}}-{{$check}}" class="collapse" data-parent="#accordion-{{$key}}-{{$check}}" aria-labelledby="heading-{{$key}}-{{$check}}">
                                        <div class="card-body">
                                            <!-- Nested accordion for sub-check-ins or details -->
                                            <div id="accordion-{{$key}}-{{$check}}-details">
                                                <div class="card">
                                                    <div class="card-header " id="heading-{{$key}}-{{$check}}-1">
                                                        <div class="row">
                                                            <div class="col-md-10">
                                                                <h5 class="mb-0">
                                                                    <div class="row w-100">
                                                                        <div class="col-12 col-md-12 mb-3 mt-2">
                                                                            <h5 class="text-lightest f-14 font-weight-normal">@lang('performance::app.progressUpdate')</h5>
                                                                            <p class="d-inline text-dark-grey f-14 pl-1">{{ $checkIn->progress_update ? $checkIn->progress_update : '--' }}</p>
                                                                        </div>
                                                                        <div class="col-12 col-md-12 mb-3 mt-2">
                                                                            <h5 class="text-lightest f-14 font-weight-normal">@lang('performance::app.barriers')</h5>
                                                                            <p class="text-dark-grey f-14 pl-1">{{ $checkIn->barriers ? $checkIn->barriers : '--' }}</p>
                                                                        </div>
                                                                    </div>
                                                                </h5>
                                                            </div>
                                                            <div class="col-md-2">
                                                                <div class="d-flex flex-row align-items-center justify-content-end">
                                                                    @if (!$managePermission)
                                                                        <div class="task_view mr-2">
                                                                            <a href="javascript:;" data-check-id="{{ $checkIn->id }}"
                                                                                class="edit-check-in task_view_more d-flex align-items-center justify-content-center">
                                                                                <i class="fa fa-edit icons mr-2"></i> @lang('app.edit')
                                                                            </a>
                                                                        </div>
                                                                    @endif
                                                                    @if (!$managePermission)
                                                                        <div class="task_view">
                                                                            <a href="javascript:;" data-check-id="{{ $checkIn->id }}"
                                                                                class="delete-check-in task_view_more d-flex align-items-center justify-content-center">
                                                                                <i class="fa fa-trash icons mr-2"></i> @lang('app.delete')
                                                                            </a>
                                                                        </div>
                                                                    @endif
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            @endforeach
                        </div>
                    @else
                        <x-cards.data otherClasses="d-flex d-xl-flex d-lg-block d-md-flex justify-content-between align-items-center">
                            <x-cards.no-record icon="user" :message="__('performance::messages.checkInsNotFound')" />
                        </x-cards.data>
                    @endif
                </div>
            </div>
        </div>
        @empty
        <x-cards.data otherClasses="d-flex d-xl-flex d-lg-block d-md-flex justify-content-between align-items-center">
            <x-cards.no-record icon="user" :message="__('performance::messages.keyResultsNotFound')" />
        </x-cards.data>
        @endforelse
    </div>
</div>

<script>
    $(document).ready(function() {
        $('.add-check-in').click(function () {
            let keyId = $(this).data('key-id');
            var url = "{{ route('check-ins.create') }}?keyResultId="+keyId;
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('.edit-check-in').click(function () {
            let keyId = $(this).data('check-id');
            let url = '{{ route("check-ins.edit", ":id")}}';
            url = url.replace(':id', keyId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('#view-objective-description').click(function () {
            let objId = $(this).data('objective-id');
            var url = '{{ route("objectives.show-description", ":id")}}';
            url = url.replace(':id', objId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('.view-key-description').click(function () {
            let keyId = $(this).data('key-id');
            var url = '{{ route("key-results.show-description", ":id")}}';
            url = url.replace(':id', keyId);

            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('body').on('click', '.delete-check-in', function () {
            Swal.fire({
                title: "@lang('messages.sweetAlertTitle')",
                text: "@lang('messages.recoverRecord')",
                icon: 'warning',
                showCancelButton: true,
                focusConfirm: false,
                confirmButtonText: "@lang('messages.confirmDelete')",
                cancelButtonText: "@lang('app.cancel')",
                customClass: {
                    confirmButton: 'btn btn-primary mr-3',
                    cancelButton: 'btn btn-secondary'
                },
                showClass: {
                    popup: 'swal2-noanimation',
                    backdrop: 'swal2-noanimation'
                },
                buttonsStyling: false
            }).then((result) => {
                if (result.isConfirmed) {
                    var id = $(this).data('check-id');
                    var token = "{{ csrf_token() }}";

                    var url = "{{ route('check-ins.destroy', ':id') }}";
                    url = url.replace(':id', id);

                    $.easyAjax({
                        type: 'POST',
                        url: url,
                        blockUI: true,
                        data: {
                            '_token': token,
                            '_method': 'DELETE'
                        },
                        success: function (response) {
                            if (response.status == "success") {
                                window.location.reload();
                            }
                        }
                    });
                }
            });
        });

        $('body').on('click', '.sendReminder', function () {
            let keyId = $(this).data('key-id');
            var url = "{{ route('key-results.send-reminder', ':id') }}";
            url = url.replace(':id', keyId);

            if (url) {
                $.easyAjax({
                    url: url,
                    type: "GET",
                    buttonSelector: $(this),
                    blockUI: true,
                    disableButton: true,
                    success: function(response) {
                        if (response.status == "success") {
                            $.easyUnblockUI();
                        }
                    }
                });
            }
        });
    });
</script>
