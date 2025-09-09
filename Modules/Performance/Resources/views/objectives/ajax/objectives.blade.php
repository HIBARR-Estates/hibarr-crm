@php
    $addCheckInPermission = user()->permission('add_check_in');
    $viewObjectivePermission = user()->permission('view_objective');
    $editObjectivePermission = user()->permission('edit_objective');
    $deleteObjectivePermission = user()->permission('delete_objective');
    $addKeyResultsPermission = user()->permission('add_key_result');
    $viewKeyResultsPermission = user()->permission('view_key_result');
    $editKeyResultsPermission = user()->permission('edit_key_result');
    $deleteKeyResultsPermission = user()->permission('delete_key_result');
@endphp

<style>
    .accordion-toggle td {
        padding: 15px;
    }
</style>

<x-table class="rounded">
    <x-slot name="thead">
        <tr>
            <th width="5%"></th>
            <th class="text-left" width="20%">@lang('performance::app.objective')</th>
            <th class="text-left">@lang('performance::app.owner')</th>
            <th class="text-left">@lang('app.team')</th>
            <th class="text-left">@lang('app.startDate')</th>
            <th class="text-left">@lang('app.endDate')</th>
            <th class="text-left">@lang('performance::app.progressNstatus')</th>
            <th class="text-right pr-3" width="5%">@lang('app.action')</th>
        </tr>
    </x-slot>

    @foreach ($objectives as $obj => $objective)
        <tr class="accordion-toggle">
            <td width="5%">
                <button class="btn btn-default btn-xs toggle-btn" data-target="#objective-{{ $obj }}"
                    data-toggle="tooltip" data-original-title="@lang('app.expand')">
                    <i class="fa fa-plus" id="plus-icon"></i>
                </button>
            </td>
            <td class="text-left pl-2" width="20%">
                <a href="{{ route('objectives.show', $objective->id) }}" class="text-darkest-grey font-weight-semibold f-13">
                    {{ Illuminate\Support\Str::limit($objective->title, 50, '...') }}<br>
                </a>
                @if ($objective->goalType && $objective->goalType->type)
                    <span class="badge badge-info">
                        {{  __('performance::app.' . $objective->goalType->type) }}
                    </span>
                @else
                    {{ '--' }}
                @endif
            </td>
            <td>
                <div class="position-relative">
                    @foreach ($objective->owners as $key => $owner)
                        @if ($key < 4)
                            <div class="taskEmployeeImg rounded-circle {{ $key > 0 ? 'position-absolute' : '' }}"
                                style="left: {{ $key * 13 }}px">
                                <a href="{{ route('employees.show', $owner->id) }}">
                                    <img data-toggle="tooltip" height="25" width="25"
                                        data-original-title="{{ $owner->name }}" src="{{ $owner->image_url }}">
                                </a>
                            </div>
                        @endif
                    @endforeach
                    @if ($objective->owners->count() > 4)
                        <div class="text-center taskEmployeeImg more-user-count rounded-circle bg-amt-grey position-absolute"
                            style="left: 52px">
                            <a href="{{ route('objectives.show', $objective->id) }}"
                                class="text-dark f-10">+{{ $objective->owners->count() - 4 }}</a>
                        </div>
                    @endif
                </div>
            </td>
            @if (!is_null($objective->department_id))
            <td class="text-left pl-2">{{ $objective->department ? $objective->department->team_name : '--' }}</td>
            @else
            <td class="text-left">--</td>
            @endif
            <td class="text-left pl-2">
                {{ \Carbon\Carbon::parse($objective->start_date)->translatedFormat(company()->date_format) }}
            </td>
            <td class="text-left pl-2">
                {{ \Carbon\Carbon::parse($objective->end_date)->translatedFormat(company()->date_format) }}
            </td>
            <td class="text-left pl-2" style="width: 300px;">
                @if ($objective->status)
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="font-weight-bold text-{{ $objective->status->color == 'primary' ? 'blue' : $objective->status->color }}">
                            {{ $objective->status->objective_progress }}%
                        </span>
                        @if ($objective->status->status)
                            <span class="badge badge-{{ $objective->status->color }}">
                                {{ __('performance::app.' . $objective->status->status) }}
                            </span>
                        @else
                            {{ '--' }}
                        @endif
                    </div>
                    <div class="progress mt-1" style="height: 6px;">
                        <div class="progress-bar f-12 bg-{{ $objective->status->color == 'primary' ? 'primary-color-bar' : $objective->status->color }}" role="progressbar"
                            style="width: {{ $objective->status->objective_progress }}%;"
                            aria-valuenow="{{ $objective->status->objective_progress }}" aria-valuemin="0"
                            aria-valuemax="100">
                        </div>
                    </div>
                    <div class="text-left mt-1">
                        <small class="text-muted">@lang('app.last') @lang('app.updatedOn')
                            {{ \Carbon\Carbon::parse($objective->status->updated_at)->translatedFormat(company()->date_format) }}
                        </small>
                    </div>
                @else
                    --
                @endif
            </td>
            <td class="text-right pr-3" width="5%">
                <div class="task_view mr-2">
                    <div class="dropdown">
                        <a class="task_view_more d-flex align-items-center justify-content-center dropdown-toggle"
                            type="link" id="dropdownMenuLink-{{ $obj }}" data-toggle="dropdown"
                            aria-haspopup="true" aria-expanded="false">
                            <i class="icon-options-vertical icons"></i>
                        </a>
                        <div class="dropdown-menu dropdown-menu-right"
                            aria-labelledby="dropdownMenuLink-{{ $obj }}" tabindex="0">

                            <a class="dropdown-item"
                                href="{{ route('objectives.show', $objective->id) }}"><i class="fa fa-eye mr-2"></i>
                                @lang('app.view')</a>

                            @if ($objective->has_access)
                                <a class="dropdown-item openRightModal"
                                    href="{{ route('objectives.edit', $objective->id) }}"><i class="fa fa-edit mr-2"></i>
                                    @lang('app.edit')</a>

                                <a class="dropdown-item delete-objective" href="javascript:;"
                                    data-objective-id="{{ $objective->id }}">
                                    <i class="fa fa-trash  mr-2"></i> @lang('app.delete')
                                </a>

                                <a class="dropdown-item openRightModal"
                                    href="{{ route('key-results.create', ['objectiveId' => $objective->id, 'currentUrl' => url()->current()]) }}">
                                    <i class="fa fa-plus mr-2"></i> @lang('app.add') @lang('performance::app.keyResult')
                                </a>
                            @endif
                        </div>
                    </div>
                </div>
            </td>
        </tr>
        <tr class="d-none">
            <td colspan="8" class="hiddenRow pl-4 pt-4 pl-4 pr-4">
                <div class="accordian-body" id="objective-{{ $obj }}">
                    @forelse ($objective->keyResults as $key => $keyResult)
                    <div class="card mb-3 border rounded">
                        <div class="card-body p-0">
                            <div class="d-flex justify-content-between align-items-center p-3">
                                <!-- Title and Badge Section -->
                                <div class="d-flex align-items-center w-25">
                                    <div class="f-15 text-darkest-grey">
                                        <span class="badge badge-secondary mr-2">{{ $key + 1 }}</span>
                                        {{ $keyResult->title }}
                                    </div>
                                </div>

                                <!-- Metrics Badge -->
                                <div class="w-15">
                                    @if($keyResult->metrics)
                                        <span class="badge badge-warning px-2 py-1">
                                            {{ $keyResult->metrics->name }}
                                        </span>
                                    @else
                                        <span class="text-lightest">--</span>
                                    @endif
                                </div>

                                <!-- Values Section -->
                                <div class="d-flex justify-content-between w-30">
                                    <div class="text-center px-3">
                                        <p class="mb-0 f-12 text-lightest">@lang('performance::app.initialValue')</p>
                                        <p class="mb-0 f-14 text-dark-grey">
                                            {{ $keyResult->original_current_value !== null ?
                                                number_format((float) $keyResult->original_current_value, 2) : '--' }}
                                        </p>
                                    </div>
                                    <div class="text-center px-3">
                                        <p class="mb-0 f-12 text-lightest">@lang('performance::app.currentValue')</p>
                                        <p class="mb-0 f-14 text-dark-grey">
                                            {{ $keyResult->current_value !== null ?
                                                number_format((float) $keyResult->current_value, 2) : '--' }}
                                        </p>
                                    </div>
                                    <div class="text-center px-3">
                                        <p class="mb-0 f-12 text-lightest">@lang('performance::app.targetValue')</p>
                                        <p class="mb-0 f-14 text-dark-grey">
                                            {{ $keyResult->target_value !== null ?
                                                number_format((float) $keyResult->target_value, 2) : '--' }}
                                        </p>
                                    </div>
                                </div>

                                <!-- Progress Bar Section -->
                                <div class="w-20 px-3">
                                    <div class="d-flex align-items-center mb-1">
                                        <div class="progress flex-grow-1 rounded" style="height: 6px;">
                                            <div class="progress-bar bg-primary" role="progressbar"
                                                style="width: {{ $keyResult->key_percentage }}%;"
                                                aria-valuenow="{{ $keyResult->key_percentage }}"
                                                aria-valuemin="0"
                                                aria-valuemax="100">
                                            </div>
                                        </div>
                                        <span class="ml-2 f-14 font-weight-bold text-dark-grey">
                                            {{ $keyResult->key_percentage }}%
                                        </span>
                                    </div>
                                </div>

                                <!-- Action Buttons -->
                                <div class="w-10 text-right pr-3">
                                    <div class="dropdown">
                                        <button class="btn btn-lg p-1" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                            <i class="fa fa-ellipsis-h text-dark-grey"></i>
                                        </button>
                                        <div class="dropdown-menu dropdown-menu-right border-grey">
                                            <a class="dropdown-item openRightModal" href="{{ route('key-results.show', $keyResult->id) }}">
                                                <i class="fa fa-eye mr-2"></i> @lang('app.view')
                                            </a>

                                            @if ($objective->has_access)
                                                <a class="dropdown-item openRightModal" href="{{ route('key-results.edit', $keyResult->id) }}?currentUrl={{ url()->current() }}">
                                                    <i class="fa fa-edit mr-2"></i> @lang('app.edit')
                                                </a>

                                                <a class="dropdown-item delete-key-results" href="javascript:;" data-key-results-id="{{ $keyResult->id }}">
                                                    <i class="fa fa-trash mr-2"></i> @lang('app.delete')
                                                </a>

                                                <a class="dropdown-item add-check-in" href="javascript:;" data-key-id="{{ $keyResult->id }}">
                                                    <i class="fa fa-plus mr-2"></i> @lang('performance::app.checkIn')
                                                </a>
                                            @endif
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Last Updated Info -->
                            <div class="border-top p-3 d-flex justify-content-between">
                                <div class="f-12 text-dark-grey">
                                    <i class="fa fa-calendar-alt mr-1"></i>
                                    @lang('app.last') @lang('app.updatedOn')
                                    {{ \Carbon\Carbon::parse($keyResult->updated_at)->format('d M, Y') }}
                                </div>
                                @if($keyResult->check_in_date)
                                <div class="f-12 text-dark-grey">
                                    <i class="fa fa-clock mr-1"></i>
                                    @lang('performance::app.lastCheckIn'):
                                    {{ \Carbon\Carbon::parse($keyResult->check_in_date)->format('d M, Y') }}
                                </div>
                                @endif
                            </div>
                        </div>
                    </div>
                    @empty
                    <div class="card border rounded">
                        <div class="card-body p-3">
                            <x-cards.no-record icon="list" :message="__('performance::messages.keyResultsNotFound')" />
                        </div>
                    </div>
                    @endforelse
                </div>
            </td>
        </tr>
    @endforeach
</x-table>

@if (count($objectives) <= 0)
    <x-cards.no-record icon="redo" :message="__('performance::messages.objectiveNotFound')" />
@endif

<script>
    $(document).ready(function () {
        $('.toggle-btn').on('click', function () {
            var targetId = $(this).data('target');
            var keyDetailsRow = $(this).closest('tr').next('tr');
            var icon = $(this).find('#plus-icon');

            keyDetailsRow.toggleClass('d-none');

            if (!keyDetailsRow.hasClass('d-none')) {
                $(targetId).show();
            } else {
                $(targetId).hide();
            }

            console.log(keyDetailsRow.hasClass('d-none'), icon);

            // Update the icon and tooltip
            if (keyDetailsRow.hasClass('d-none')) {
                icon.removeClass('fa-minus').addClass('fa-plus');
                $(this).attr('data-original-title', '@lang("app.expand")');
            } else {
                icon.removeClass('fa-plus').addClass('fa-minus');
                $(this).attr('data-original-title', '@lang("app.collapse")');
            }

            // Re-enable tooltips after changing the title
            $('[data-toggle="tooltip"]').tooltip('dispose').tooltip();
        });

        $(document).on('show.bs.dropdown', '.table-responsive', function() {
            $('.table-responsive').css("overflow", "inherit");
        });

        $('.add-check-in').click(function () {
            let keyId = $(this).data('key-id');
            var url = "{{ route('check-ins.create') }}?keyResultId=" + keyId;
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });
    });
</script>



