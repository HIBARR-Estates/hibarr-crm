@extends('layouts.app')

@section('content')

    @php
        $statusColors = [
            'pending' => 'secondary',
            'scheduled' => 'info',
            'sending' => 'warning',
            'sent' => 'success',
            'failed' => 'danger',
            'cancelled' => 'dark',
        ];
        $timezone = company()->timezone ?? config('app.timezone');
        $dateFormat = company()->date_format ?? 'Y-m-d';
        $timeFormat = company()->time_format ?? 'H:i';
        $activeFilters = array_filter([
            'status' => $filters['status'] ?? null,
            'entity_type' => $filters['entity_type'] ?? null,
            'search' => $filters['search'] ?? null,
            'date_from' => $filters['date_from'] ?? null,
            'date_to' => $filters['date_to'] ?? null,
            'per_page' => $filters['per_page'] ?? 25,
        ], fn ($value) => $value !== null && $value !== '');
    @endphp

    <div class="w-100 d-flex">
        <x-setting-sidebar :activeMenu="$activeSettingMenu" />

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal border-bottom-grey">
                        @lang($pageTitle)
                    </h2>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4">
                <div class="row">
                    <div class="col-lg-12 mb-3">
                        <p class="f-13 text-lightest mb-0">
                            @lang('modules.settings.reminderLedgerDescription')
                        </p>
                    </div>

                    <div class="col-lg-12 mb-3">
                        <div class="d-flex flex-wrap align-items-center">
                            <a href="{{ route('reminder-ledger.index', collect($activeFilters)->except('status')->all()) }}"
                               class="badge badge-light border mr-2 mb-2 f-12 {{ empty($filters['status']) ? 'border-primary' : '' }}">
                                @lang('app.all'): {{ array_sum($statusCounts) }}
                            </a>
                            @foreach ($statuses as $status)
                                @php $count = (int) ($statusCounts[$status] ?? 0); @endphp
                                <a href="{{ route('reminder-ledger.index', array_merge(collect($activeFilters)->except('status')->all(), ['status' => $status])) }}"
                                   class="badge badge-{{ $statusColors[$status] ?? 'secondary' }} mr-2 mb-2 f-12"
                                   @if (($filters['status'] ?? '') === $status) style="outline: 2px solid #003160;" @endif>
                                    {{ ucfirst($status) }}: {{ $count }}
                                </a>
                            @endforeach
                        </div>
                    </div>

                    <div class="col-lg-12 mb-4">
                        <form method="GET" action="{{ route('reminder-ledger.index') }}" id="reminder-ledger-filters" class="bg-white border rounded p-3">
                            <div class="row align-items-end">
                                <div class="col-md-2 form-group mb-2">
                                    <label class="f-13 text-dark-grey" for="filter_status">@lang('app.status')</label>
                                    <select name="status" id="filter_status" class="form-control">
                                        <option value="">@lang('app.all')</option>
                                        @foreach ($statuses as $status)
                                            <option value="{{ $status }}" @selected(($filters['status'] ?? '') === $status)>
                                                {{ ucfirst($status) }}
                                            </option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-md-2 form-group mb-2">
                                    <label class="f-13 text-dark-grey" for="filter_entity_type">@lang('modules.settings.entityType')</label>
                                    <select name="entity_type" id="filter_entity_type" class="form-control">
                                        <option value="">@lang('app.all')</option>
                                        @foreach ($entityTypes as $type)
                                            <option value="{{ $type }}" @selected(($filters['entity_type'] ?? '') === $type)>
                                                {{ str_replace('_', ' ', ucfirst($type)) }}
                                            </option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-md-2 form-group mb-2">
                                    <label class="f-13 text-dark-grey" for="filter_date_from">@lang('modules.settings.remindAt') (@lang('app.from'))</label>
                                    <input type="date"
                                           name="date_from"
                                           id="filter_date_from"
                                           class="form-control height-35"
                                           value="{{ $filters['date_from'] ?? '' }}">
                                </div>
                                <div class="col-md-2 form-group mb-2">
                                    <label class="f-13 text-dark-grey" for="filter_date_to">@lang('modules.settings.remindAt') (@lang('app.to'))</label>
                                    <input type="date"
                                           name="date_to"
                                           id="filter_date_to"
                                           class="form-control height-35"
                                           value="{{ $filters['date_to'] ?? '' }}">
                                </div>
                                <div class="col-md-2 form-group mb-2">
                                    <label class="f-13 text-dark-grey" for="filter_search">@lang('app.search')</label>
                                    <input type="text"
                                           name="search"
                                           id="filter_search"
                                           class="form-control height-35"
                                           value="{{ $filters['search'] ?? '' }}"
                                           placeholder="@lang('modules.settings.reminderLedgerSearchPlaceholder')">
                                </div>
                                <div class="col-md-1 form-group mb-2">
                                    <label class="f-13 text-dark-grey" for="filter_per_page">Per page</label>
                                    <select name="per_page" id="filter_per_page" class="form-control">
                                        @foreach ($perPageOptions as $option)
                                            <option value="{{ $option }}" @selected((int) ($filters['per_page'] ?? 25) === $option)>
                                                {{ $option }}
                                            </option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="col-md-1 form-group mb-2">
                                    <button type="submit" class="btn btn-primary btn-block">@lang('app.apply')</button>
                                </div>
                            </div>
                            <div class="mt-1">
                                <a href="{{ route('reminder-ledger.index') }}" class="f-12">@lang('app.reset')</a>
                            </div>
                        </form>
                    </div>

                    <div class="col-lg-12 mb-2 d-flex justify-content-between align-items-center flex-wrap">
                        <p class="f-13 text-dark-grey mb-2">
                            @if ($reminders->total() === 0)
                                @lang('modules.settings.noRemindersFound')
                            @else
                                Showing {{ $reminders->firstItem() }}–{{ $reminders->lastItem() }}
                                of {{ $reminders->total() }} reminders
                                (page {{ $reminders->currentPage() }} of {{ $reminders->lastPage() }})
                            @endif
                        </p>
                    </div>

                    <div class="col-lg-12">
                        <div class="table-responsive">
                            <table class="table table-hover border bg-white">
                                <thead class="thead-light">
                                <tr>
                                    <th>ID</th>
                                    <th>@lang('modules.settings.entityType')</th>
                                    <th>Entity ID</th>
                                    <th>@lang('app.status')</th>
                                    <th>@lang('modules.settings.remindAt')</th>
                                    <th>@lang('modules.settings.sentAt')</th>
                                    <th>@lang('app.email')</th>
                                    <th>@lang('app.message')</th>
                                    <th>@lang('app.error')</th>
                                </tr>
                                </thead>
                                <tbody>
                                @forelse ($reminders as $reminder)
                                    <tr>
                                        <td class="f-12">{{ $reminder->id }}</td>
                                        <td class="f-12">{{ str_replace('_', ' ', $reminder->entity_type) }}</td>
                                        <td class="f-12">#{{ $reminder->entity_id }}</td>
                                        <td>
                                            <span class="badge badge-{{ $statusColors[$reminder->status] ?? 'secondary' }}">
                                                {{ $reminder->status }}
                                            </span>
                                        </td>
                                        <td class="f-12">
                                            {{ $reminder->remind_at?->copy()->timezone($timezone)->format($dateFormat.' '.$timeFormat) ?? '—' }}
                                        </td>
                                        <td class="f-12">
                                            {{ $reminder->sent_at?->copy()->timezone($timezone)->format($dateFormat.' '.$timeFormat) ?? '—' }}
                                        </td>
                                        <td class="f-12">{{ $reminder->recipient_email }}</td>
                                        <td class="f-12" style="max-width: 220px;">
                                            <span title="{{ $reminder->message }}">{{ \Illuminate\Support\Str::limit($reminder->message, 60) }}</span>
                                        </td>
                                        <td class="f-12 text-danger" style="max-width: 220px;">
                                            @if ($reminder->last_error)
                                                <span title="{{ $reminder->last_error }}">{{ \Illuminate\Support\Str::limit($reminder->last_error, 80) }}</span>
                                            @else
                                                —
                                            @endif
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="9" class="text-center text-lightest py-4">
                                            @lang('modules.settings.noRemindersFound')
                                        </td>
                                    </tr>
                                @endforelse
                                </tbody>
                            </table>
                        </div>

                        @if ($reminders->hasPages())
                            <div class="mt-3 d-flex justify-content-center">
                                {{ $reminders->onEachSide(1)->links('pagination::bootstrap-4') }}
                            </div>
                        @endif
                    </div>
                </div>
            </div>
        </x-setting-card>
    </div>

@endsection
