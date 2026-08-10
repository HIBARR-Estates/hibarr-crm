@extends('layouts.app')

@section('content')

@php
    $tab = $filters['tab'] ?? 'all';
    $search = $filters['search'] ?? '';
    $entityType = $filters['entity_type'] ?? 'all';
    $dateRange = $filters['date_range'] ?? 'all';
    $customDate = $filters['custom_date'] ?? '';
    $showDatePicker = $dateRange === 'custom';

    $queryBase = array_filter([
        'search' => $search !== '' ? $search : null,
        'entity_type' => ($entityType !== '' && $entityType !== 'all') ? $entityType : null,
        'date_range' => ($dateRange !== '' && $dateRange !== 'all') ? $dateRange : null,
        'custom_date' => ($dateRange === 'custom' && $customDate !== '') ? $customDate : null,
        'per_page' => $filters['per_page'] ?? null,
    ], fn ($v) => $v !== null && $v !== '');

    $tabs = [
        ['key' => 'all', 'label' => 'All'],
        ['key' => 'delayed', 'label' => 'Delayed'],
        ['key' => 'sent', 'label' => 'Sent'],
        ['key' => 'cancelled', 'label' => 'Cancelled'],
        ['key' => 'failed', 'label' => 'Failed'],
    ];

    $entityTypeLabels = [
        'meeting' => 'Meetings',
        'task' => 'Tasks',
        'deal_note' => 'Notes',
        'lead_note' => 'Notes',
        'deal' => 'Deals',
        'lead' => 'Leads',
        'property' => 'Properties',
        'developer_project' => 'Projects',
        'unit' => 'Units',
        'flight_itinerary' => 'Flights',
    ];

    $gridCols = '130px minmax(150px, 1.4fr) minmax(140px, 1fr) 84px 96px 118px 172px';
    $drawerRows = [];
    foreach ($groups as $group) {
        foreach ($group['rows'] as $row) {
            $drawerRows[$row['id']] = $row;
        }
    }

    if ($reminders->total() === 0) {
        $resultCount = '0 reminders';
    } elseif ($reminders->firstItem()) {
        $resultCount = $reminders->firstItem().'–'.$reminders->lastItem().' of '.$reminders->total();
    } else {
        $resultCount = $reminders->total().' reminder'.($reminders->total() === 1 ? '' : 's');
    }
@endphp

<div class="w-100 d-flex">
    <x-setting-sidebar :activeMenu="$activeSettingMenu" />

    <div class="w-100 rd-page-wrap">
        <div class="rd-page-inner">
            <div class="rd-page-content">

                <div class="rd-header">
                    <div>
                        <h1 class="rd-title">Reminders</h1>
                        <p class="rd-subtitle">Scheduled and sent reminder emails</p>
                    </div>
                </div>

                <div class="om-scroll-x rd-stats-row">
                    @foreach ([
                        ['label' => 'Sent', 'value' => $stats['sent'], 'color' => '#067647'],
                        ['label' => 'Delayed', 'value' => $stats['delayed'], 'color' => '#b54708'],
                        ['label' => 'Cancelled', 'value' => $stats['cancelled'], 'color' => '#475467'],
                        ['label' => 'Failed', 'value' => $stats['failed'], 'color' => '#b42318'],
                    ] as $s)
                        <div class="rd-stat-card">
                            <div class="rd-stat-label">{{ $s['label'] }}</div>
                            <div class="rd-stat-value" style="color:{{ $s['color'] }};">{{ $s['value'] }}</div>
                        </div>
                    @endforeach
                </div>

                @if (session('success'))
                    <div class="rd-flash rd-flash-success">{{ session('success') }}</div>
                @endif
                @if (session('error'))
                    <div class="rd-flash rd-flash-error">{{ session('error') }}</div>
                @endif

                @if ($showDelayBanner)
                    <div class="rd-delay-banner">
                        <span class="rd-delay-dot"></span>
                        <span><strong>{{ $delayBannerText }}</strong> — delivery ran behind schedule. Worst delay: {{ $worstDelay }}.</span>
                    </div>
                @endif

                <div class="rd-card">
                    <div class="om-scroll-x rd-tabs">
                        @foreach ($tabs as $item)
                            @php
                                $active = $tab === $item['key'];
                                $count = (int) ($tabCounts[$item['key']] ?? 0);
                            @endphp
                            <a href="{{ route('reminder-ledger.index', array_merge($queryBase, ['tab' => $item['key']])) }}"
                               class="rd-tab {{ $active ? 'rd-tab-active' : '' }}">
                                {{ $item['label'] }}
                                <span class="rd-tab-badge {{ $active ? 'rd-tab-badge-active' : '' }}">{{ $count }}</span>
                            </a>
                        @endforeach
                    </div>

                    <form method="GET" action="{{ route('reminder-ledger.index') }}" class="rd-filters" id="rd-filter-form">
                        <input type="hidden" name="tab" value="{{ $tab }}">
                        <input type="hidden" name="per_page" value="{{ $filters['per_page'] ?? 25 }}">
                        <input type="text"
                               name="search"
                               value="{{ $search }}"
                               placeholder="Search reminder, email, or entity…"
                               class="rd-search-input">
                        <select name="entity_type" class="rd-select" onchange="this.form.submit()">
                            <option value="all" @selected($entityType === 'all' || $entityType === '')>All types</option>
                            @foreach ($entityTypes as $type)
                                <option value="{{ $type }}" @selected($entityType === $type)>
                                    {{ $entityTypeLabels[$type] ?? str_replace('_', ' ', ucfirst($type)) }}
                                </option>
                            @endforeach
                        </select>
                        <select name="date_range" class="rd-select" id="rd-date-range" onchange="rdOnDateRangeChange(this)">
                            <option value="all" @selected($dateRange === 'all')>All dates</option>
                            <option value="today" @selected($dateRange === 'today')>Today</option>
                            <option value="yesterday" @selected($dateRange === 'yesterday')>Yesterday</option>
                            <option value="7d" @selected($dateRange === '7d')>Last 7 days</option>
                            <option value="custom" @selected($dateRange === 'custom')>Specific day…</option>
                        </select>
                        <input type="date"
                               name="custom_date"
                               value="{{ $customDate }}"
                               class="rd-date-input {{ $showDatePicker ? '' : 'd-none' }}"
                               id="rd-custom-date"
                               onchange="this.form.submit()">
                        @if ($hasFilters)
                            <a href="{{ route('reminder-ledger.index') }}" class="rd-reset-link">Reset</a>
                        @endif
                        <div class="rd-result-count">{{ $resultCount }}</div>
                    </form>

                    @if (!$isEmpty)
                        <div class="rd-desktop-only om-scroll-x">
                            <div class="rd-grid rd-grid-head" style="grid-template-columns:{{ $gridCols }};">
                                <div>Entity</div>
                                <div>Reminder</div>
                                <div>Recipient</div>
                                <div>Remind at</div>
                                <div>Delivery</div>
                                <div>Status</div>
                                <div></div>
                            </div>
                            @foreach ($groups as $group)
                                <div>
                                    <div class="rd-group-head" style="min-width:906px;">
                                        <span class="rd-group-label">{{ $group['label'] }}</span>
                                        <span class="rd-group-sub">{{ $group['sub'] }}</span>
                                    </div>
                                    @foreach ($group['rows'] as $r)
                                        <div class="rd-row rd-grid"
                                             style="grid-template-columns:{{ $gridCols }};"
                                             data-row-id="{{ $r['id'] }}"
                                             onclick="rdOpenDrawer({{ $r['id'] }})">
                                            <div class="rd-cell">
                                                <span class="rd-chip" style="background:{{ $r['chipBg'] }};color:{{ $r['chipColor'] }};">{{ $r['chipLabel'] }}</span>
                                            </div>
                                            <div class="rd-cell rd-cell-reminder">
                                                <div class="rd-about">{{ $r['about'] }}</div>
                                                <div class="rd-sub">{{ $r['sub'] }}</div>
                                            </div>
                                            <div class="rd-cell rd-cell-recipient">
                                                <span class="rd-avatar" style="background:{{ $r['avatarBg'] }};color:{{ $r['avatarColor'] }};">{{ $r['initials'] }}</span>
                                                <span class="rd-recipient-text">
                                                    <span class="rd-recipient-name">{{ $r['name'] }}</span>
                                                    <span class="rd-recipient-email">{{ $r['email'] }}</span>
                                                </span>
                                            </div>
                                            <div class="rd-cell rd-time">{{ $r['timeText'] }}</div>
                                            <div class="rd-cell rd-delivery" style="font-weight:{{ $r['deliveryWeight'] }};color:{{ $r['deliveryColor'] }};">{{ $r['deliveryText'] }}</div>
                                            <div class="rd-cell">
                                                <span class="rd-status" style="background:{{ $r['statusBg'] }};color:{{ $r['statusColor'] }};">
                                                    <span class="rd-status-dot" style="background:{{ $r['dotColor'] }};"></span>
                                                    {{ $r['statusLabel'] }}
                                                </span>
                                            </div>
                                            <div class="rd-cell rd-actions" onclick="event.stopPropagation()">
                                                @if ($r['cancellable'])
                                                    <form method="POST" action="{{ route('reminder-ledger.send-now', ['reminder' => $r['id']]) }}" class="d-inline" onsubmit="return confirm('Send this reminder now, ahead of schedule?')">
                                                        @csrf
                                                        <button type="submit" class="rd-btn-send">Send now</button>
                                                    </form>
                                                    <form method="POST" action="{{ route('reminder-ledger.cancel', ['reminder' => $r['id']]) }}" class="d-inline" onsubmit="return confirm('Cancel this reminder? It won\'t be sent.')">
                                                        @csrf
                                                        <button type="submit" class="rd-btn-cancel">Cancel</button>
                                                    </form>
                                                @endif
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            @endforeach
                        </div>

                        <div class="rd-mobile-only">
                            @foreach ($groups as $group)
                                <div>
                                    <div class="rd-mobile-group-head">
                                        <span class="rd-group-label">{{ $group['label'] }}</span>
                                        <span class="rd-group-sub">{{ $group['shortSub'] ?? $group['sub'] }}</span>
                                    </div>
                                    @foreach ($group['rows'] as $r)
                                        <div class="rd-mobile-row" onclick="rdOpenDrawer({{ $r['id'] }})">
                                            <div class="rd-mobile-row-top">
                                                <span class="rd-chip" style="background:{{ $r['chipBg'] }};color:{{ $r['chipColor'] }};">{{ $r['chipLabel'] }}</span>
                                                <span class="rd-status" style="background:{{ $r['statusBg'] }};color:{{ $r['statusColor'] }};">
                                                    <span class="rd-status-dot" style="background:{{ $r['dotColor'] }};"></span>
                                                    {{ $r['statusLabel'] }}
                                                </span>
                                            </div>
                                            <div>
                                                <div class="rd-mobile-about">{{ $r['about'] }}</div>
                                                <div class="rd-mobile-sub">{{ $r['sub'] }}</div>
                                            </div>
                                            <div class="rd-mobile-recipient">
                                                <span class="rd-avatar rd-avatar-sm" style="background:{{ $r['avatarBg'] }};color:{{ $r['avatarColor'] }};">{{ $r['initials'] }}</span>
                                                <span class="rd-mobile-email">{{ $r['email'] }}</span>
                                            </div>
                                            <div class="rd-mobile-footer" onclick="event.stopPropagation()">
                                                <span class="rd-mobile-timing">
                                                    {{ $r['timeText'] }} ·
                                                    <span style="color:{{ $r['deliveryColor'] }};font-weight:{{ $r['deliveryWeight'] }};">{{ $r['deliveryText'] }}</span>
                                                </span>
                                                @if ($r['cancellable'])
                                                    <span class="rd-mobile-actions">
                                                        <form method="POST" action="{{ route('reminder-ledger.send-now', ['reminder' => $r['id']]) }}" class="d-inline" onsubmit="return confirm('Send this reminder now, ahead of schedule?')">
                                                            @csrf
                                                            <button type="submit" class="rd-btn-send">Send now</button>
                                                        </form>
                                                        <form method="POST" action="{{ route('reminder-ledger.cancel', ['reminder' => $r['id']]) }}" class="d-inline" onsubmit="return confirm('Cancel this reminder? It won\'t be sent.')">
                                                            @csrf
                                                            <button type="submit" class="rd-btn-cancel">Cancel</button>
                                                        </form>
                                                    </span>
                                                @endif
                                            </div>
                                        </div>
                                    @endforeach
                                </div>
                            @endforeach
                        </div>
                    @else
                        <div class="rd-empty">
                            <div class="rd-empty-title">No reminders match</div>
                            <div class="rd-empty-sub">Try clearing the search, date, or tab filters.</div>
                        </div>
                    @endif

                    @if ($reminders->hasPages())
                        <div class="rd-pagination">
                            {{ $reminders->onEachSide(1)->links('pagination::bootstrap-4') }}
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>

<div id="rd-drawer-backdrop" class="rd-drawer-backdrop d-none" onclick="rdCloseDrawer()"></div>
<div id="rd-drawer" class="rd-drawer d-none" aria-hidden="true">
    <div class="rd-drawer-header">
        <div>
            <div class="rd-drawer-id" id="rd-drawer-id"></div>
            <div class="rd-drawer-title" id="rd-drawer-title"></div>
            <div id="rd-drawer-status-wrap"></div>
        </div>
        <button type="button" class="rd-drawer-close" onclick="rdCloseDrawer()" aria-label="Close">×</button>
    </div>
    <div class="rd-drawer-body">
        <div>
            <div class="rd-drawer-section-label">What it's about</div>
            <div class="rd-drawer-box-muted">
                <div class="rd-drawer-entity-row">
                    <span id="rd-drawer-chip" class="rd-chip"></span>
                    <span id="rd-drawer-entity-name" class="rd-drawer-entity-name"></span>
                </div>
                <div id="rd-drawer-entity-detail" class="rd-drawer-entity-detail"></div>
            </div>
        </div>
        <div>
            <div class="rd-drawer-section-label">Email message</div>
            <div class="rd-drawer-box">
                <div id="rd-drawer-subject" class="rd-drawer-subject"></div>
                <div id="rd-drawer-body-text" class="rd-drawer-body-text"></div>
            </div>
        </div>
        <div>
            <div class="rd-drawer-section-label">Who</div>
            <div class="rd-drawer-who">
                <span id="rd-drawer-avatar" class="rd-avatar rd-avatar-lg"></span>
                <span>
                    <span id="rd-drawer-name" class="rd-drawer-name"></span>
                    <span id="rd-drawer-email" class="rd-drawer-email"></span>
                </span>
            </div>
            <div id="rd-drawer-created-by" class="rd-drawer-created-by"></div>
        </div>
        <div>
            <div class="rd-drawer-section-label">Timeline</div>
            <div id="rd-drawer-timeline"></div>
        </div>
        <div id="rd-drawer-error-wrap" class="d-none">
            <div class="rd-drawer-error" id="rd-drawer-error"></div>
        </div>
    </div>
    <div id="rd-drawer-footer" class="rd-drawer-footer d-none">
        <form id="rd-drawer-send-form" method="POST" action="" onsubmit="return confirm('Send this reminder now, ahead of schedule?')">
            @csrf
            <button type="submit" class="rd-drawer-btn-primary">Send now</button>
        </form>
        <form id="rd-drawer-cancel-form" method="POST" action="" onsubmit="return confirm('Cancel this reminder? It won\'t be sent.')">
            @csrf
            <button type="submit" class="rd-drawer-btn-danger">Cancel reminder</button>
        </form>
    </div>
</div>

@endsection

@push('styles')
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
    .om-scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .rd-page-wrap { background: #f4f5f7; min-height: 100vh; overflow: auto; }
    .rd-page-inner { font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #1a202c; padding: 32px 40px 64px; }
    .rd-page-content { max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .rd-title { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
    .rd-subtitle { margin: 4px 0 0; font-size: 14px; color: #667085; }
    .rd-stats-row { display: flex; gap: 10px; padding-bottom: 2px; }
    .rd-stat-card { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; padding: 10px 16px; min-width: 96px; flex: 1 0 auto; }
    .rd-stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #667085; white-space: nowrap; }
    .rd-stat-value { font-size: 20px; font-weight: 700; }
    .rd-flash { border-radius: 10px; padding: 10px 16px; font-size: 13.5px; }
    .rd-flash-success { background: #ecfdf3; border: 1px solid #abefc6; color: #067647; }
    .rd-flash-error { background: #fef3f2; border: 1px solid #fecdca; color: #b42318; }
    .rd-delay-banner { display: flex; align-items: flex-start; gap: 10px; background: #fffaeb; border: 1px solid #fedf89; border-radius: 10px; padding: 10px 16px; font-size: 13.5px; color: #93370d; line-height: 1.45; }
    .rd-delay-dot { width: 8px; height: 8px; border-radius: 50%; background: #f79009; flex-shrink: 0; margin-top: 6px; }
    .rd-card { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; overflow: hidden; }
    .rd-tabs { display: flex; align-items: center; gap: 4px; padding: 8px 12px 0; border-bottom: 1px solid #e4e7ec; }
    .rd-tab { text-decoration: none; appearance: none; background: none; border: none; border-bottom: 2px solid transparent; padding: 10px 10px 12px; font-family: inherit; font-size: 14px; font-weight: 500; color: #667085; cursor: pointer; display: flex; align-items: center; gap: 7px; white-space: nowrap; flex: 0 0 auto; min-height: 44px; }
    .rd-tab-active { border-bottom-color: #2563eb; font-weight: 600; color: #1a202c; }
    .rd-tab-badge { font-size: 12px; font-weight: 600; background: #f2f4f7; color: #475467; border-radius: 999px; padding: 1px 8px; }
    .rd-tab-badge-active { background: #eff8ff; color: #175cd3; }
    .rd-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px; border-bottom: 1px solid #e4e7ec; background: #fcfcfd; }
    .rd-search-input { flex: 1 1 200px; min-width: 0; max-width: 340px; font-family: inherit; font-size: 16px; color: #1a202c; background: #fff; border: 1px solid #d0d5dd; border-radius: 8px; padding: 10px 12px; outline: none; }
    .rd-search-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
    .rd-select, .rd-date-input { flex: 0 1 auto; font-family: inherit; font-size: 16px; color: #1a202c; background: #fff; border: 1px solid #d0d5dd; border-radius: 8px; padding: 10px; outline: none; cursor: pointer; min-height: 44px; }
    .rd-reset-link { appearance: none; background: none; border: none; font-family: inherit; font-size: 13.5px; font-weight: 500; color: #1d4ed8; cursor: pointer; padding: 8px; min-height: 44px; text-decoration: none; display: inline-flex; align-items: center; }
    .rd-result-count { margin-left: auto; font-size: 13px; color: #667085; white-space: nowrap; }
    .rd-grid { display: grid; min-width: 906px; box-sizing: border-box; align-items: center; padding: 0 16px; }
    .rd-grid-head { padding: 0 16px; border-bottom: 1px solid #e4e7ec; background: #fcfcfd; }
    .rd-grid-head > div { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #667085; padding: 10px 8px; }
    .rd-group-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; box-sizing: border-box; padding: 10px 24px; background: #f8f9fb; border-bottom: 1px solid #e4e7ec; }
    .rd-group-label { font-size: 13px; font-weight: 600; color: #344054; white-space: nowrap; }
    .rd-group-sub { font-size: 12.5px; color: #98a2b3; white-space: nowrap; }
    .rd-row { border-bottom: 1px solid #eef0f3; cursor: pointer; }
    .rd-row:hover { background: #f5f8ff; }
    .rd-cell { padding: 11px 8px; min-width: 0; }
    .rd-cell-reminder { padding: 9px 8px; }
    .rd-about { font-size: 14px; font-weight: 500; color: #1a202c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rd-sub { font-size: 12px; color: #98a2b3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rd-chip { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 6px; padding: 3px 8px; display: inline-block; }
    .rd-cell-recipient { display: flex; align-items: center; gap: 9px; overflow: hidden; }
    .rd-avatar { width: 26px; height: 26px; border-radius: 50%; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .rd-avatar-sm { width: 22px; height: 22px; font-size: 10px; }
    .rd-avatar-lg { width: 34px; height: 34px; font-size: 13px; }
    .rd-recipient-text { min-width: 0; display: block; }
    .rd-recipient-name { display: block; font-size: 13.5px; font-weight: 500; color: #344054; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rd-recipient-email { display: block; font-size: 12px; color: #98a2b3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rd-time { font-size: 13.5px; color: #344054; font-variant-numeric: tabular-nums; }
    .rd-delivery { font-size: 13px; }
    .rd-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 500; border-radius: 999px; padding: 3px 10px; }
    .rd-status-dot { width: 6px; height: 6px; border-radius: 50%; }
    .rd-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    .rd-btn-send, .rd-btn-cancel { appearance: none; font-family: inherit; font-size: 13.5px; font-weight: 500; background: #fff; border-radius: 8px; padding: 9px 14px; cursor: pointer; min-height: 44px; white-space: nowrap; }
    .rd-btn-send { color: #1d4ed8; border: 1px solid #b2ddff; }
    .rd-btn-cancel { color: #b42318; border: 1px solid #fecdca; }
    .rd-empty { padding: 48px 24px; text-align: center; }
    .rd-empty-title { font-size: 15px; font-weight: 600; color: #344054; }
    .rd-empty-sub { font-size: 13.5px; color: #667085; margin-top: 4px; }
    .rd-pagination { padding: 16px; display: flex; justify-content: center; border-top: 1px solid #e4e7ec; background: #fcfcfd; }
    .rd-mobile-only { display: none; }
    .rd-mobile-group-head { display: flex; align-items: baseline; gap: 8px; padding: 10px 16px; background: #f8f9fb; border-bottom: 1px solid #e4e7ec; position: sticky; top: 0; z-index: 2; }
    .rd-mobile-row { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border-bottom: 1px solid #eef0f3; cursor: pointer; }
    .rd-mobile-row-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .rd-mobile-about { font-size: 15px; font-weight: 600; color: #1a202c; line-height: 1.3; }
    .rd-mobile-sub { font-size: 12.5px; color: #98a2b3; margin-top: 2px; }
    .rd-mobile-recipient { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .rd-mobile-email { font-size: 13px; color: #667085; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rd-mobile-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .rd-mobile-timing { font-size: 13px; color: #344054; font-variant-numeric: tabular-nums; }
    .rd-mobile-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .rd-drawer-backdrop { position: fixed; inset: 0; background: rgba(16,24,40,0.35); z-index: 1040; }
    .rd-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 420px; max-width: 100%; background: #fff; z-index: 1050; box-shadow: 0 8px 40px rgba(16,24,40,0.18); display: flex; flex-direction: column; overflow-y: auto; }
    .rd-drawer-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px 16px; border-bottom: 1px solid #e4e7ec; position: sticky; top: 0; background: #fff; z-index: 2; }
    .rd-drawer-id { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #98a2b3; }
    .rd-drawer-title { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin-top: 2px; line-height: 1.3; }
    .rd-drawer-close { appearance: none; background: none; border: none; font-size: 22px; line-height: 1; color: #98a2b3; cursor: pointer; padding: 8px; min-width: 44px; min-height: 44px; flex-shrink: 0; }
    .rd-drawer-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; flex: 1; }
    .rd-drawer-section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #98a2b3; margin-bottom: 8px; }
    .rd-drawer-box-muted { background: #f8f9fb; border: 1px solid #eef0f3; border-radius: 10px; padding: 12px 14px; }
    .rd-drawer-box { border: 1px solid #eef0f3; border-radius: 10px; padding: 12px 14px; }
    .rd-drawer-entity-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .rd-drawer-entity-name { font-size: 14px; font-weight: 600; color: #1a202c; }
    .rd-drawer-entity-detail { font-size: 13px; color: #667085; margin-top: 6px; }
    .rd-drawer-subject { font-size: 13.5px; font-weight: 600; color: #344054; }
    .rd-drawer-body-text { font-size: 13px; color: #667085; margin-top: 4px; line-height: 1.5; }
    .rd-drawer-who { display: flex; align-items: center; gap: 10px; }
    .rd-drawer-name { display: block; font-size: 14px; font-weight: 600; color: #1a202c; }
    .rd-drawer-email { display: block; font-size: 12.5px; color: #98a2b3; overflow: hidden; text-overflow: ellipsis; }
    .rd-drawer-created-by { font-size: 12.5px; color: #667085; margin-top: 8px; }
    .rd-timeline-item { display: flex; gap: 10px; padding: 5px 0; }
    .rd-timeline-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
    .rd-timeline-label { display: block; font-size: 13.5px; font-weight: 500; }
    .rd-timeline-when { display: block; font-size: 12.5px; color: #98a2b3; }
    .rd-drawer-error { background: #fef3f2; border: 1px solid #fecdca; border-radius: 10px; padding: 10px 14px; font-size: 13.5px; color: #b42318; }
    .rd-drawer-footer { padding: 14px 20px; border-top: 1px solid #e4e7ec; background: #fcfcfd; position: sticky; bottom: 0; display: flex; gap: 10px; flex-wrap: wrap; }
    .rd-drawer-btn-primary, .rd-drawer-btn-danger { appearance: none; flex: 1 1 140px; font-family: inherit; font-size: 15px; font-weight: 600; border-radius: 8px; padding: 12px 14px; cursor: pointer; min-height: 48px; border: none; }
    .rd-drawer-btn-primary { color: #fff; background: #2563eb; }
    .rd-drawer-btn-danger { color: #b42318; background: #fff; border: 1px solid #fecdca; }
    .setting-sidebar + div .pagination { margin-bottom: 0; }
    @media (max-width: 767px) {
        .rd-page-inner { padding: 20px 16px 48px; }
        .rd-title { font-size: 22px; }
        .rd-desktop-only { display: none !important; }
        .rd-mobile-only { display: block; }
        .rd-drawer { left: 0; right: 0; bottom: 0; top: auto; width: auto; max-height: 92vh; border-radius: 16px 16px 0 0; box-shadow: 0 -8px 40px rgba(16,24,40,0.18); }
    }
</style>
@endpush

@push('scripts')
<script>
    const rdRows = @json($drawerRows);
    const rdSendBase = @json(url('account/settings/reminder-ledger'));
    const rdCancelBase = @json(url('account/settings/reminder-ledger'));

    function rdOnDateRangeChange(select) {
        const custom = document.getElementById('rd-custom-date');
        if (select.value === 'custom') {
            custom.classList.remove('d-none');
            return;
        }
        custom.classList.add('d-none');
        select.form.submit();
    }

    function rdOpenDrawer(id) {
        const row = rdRows[id];
        if (!row) return;

        document.getElementById('rd-drawer-id').textContent = 'Reminder #' + row.id;
        document.getElementById('rd-drawer-title').textContent = row.about || '—';

        const statusWrap = document.getElementById('rd-drawer-status-wrap');
        statusWrap.innerHTML = '<span class="rd-status" style="background:' + row.statusBg + ';color:' + row.statusColor + ';">' +
            '<span class="rd-status-dot" style="background:' + row.dotColor + ';"></span>' + row.statusLabel + '</span>';

        const chip = document.getElementById('rd-drawer-chip');
        chip.textContent = row.chipLabel;
        chip.style.background = row.chipBg;
        chip.style.color = row.chipColor;

        document.getElementById('rd-drawer-entity-name').textContent = row.entityName || '—';
        document.getElementById('rd-drawer-entity-detail').textContent = row.entityDetail || '—';
        document.getElementById('rd-drawer-subject').textContent = row.subject || '—';
        document.getElementById('rd-drawer-body-text').textContent = row.body || '—';

        const avatar = document.getElementById('rd-drawer-avatar');
        avatar.textContent = row.initials;
        avatar.style.background = row.avatarBg;
        avatar.style.color = row.avatarColor;

        document.getElementById('rd-drawer-name').textContent = row.name || '—';
        document.getElementById('rd-drawer-email').textContent = row.email || '—';
        document.getElementById('rd-drawer-created-by').textContent = 'Created by ' + (row.createdBy || '—');

        const timeline = document.getElementById('rd-drawer-timeline');
        timeline.innerHTML = '';
        (row.timeline || []).forEach(function (ev) {
            const item = document.createElement('div');
            item.className = 'rd-timeline-item';
            item.innerHTML = '<span class="rd-timeline-dot" style="background:' + ev.dot + ';"></span>' +
                '<span><span class="rd-timeline-label" style="color:' + ev.color + ';">' + ev.label + '</span>' +
                '<span class="rd-timeline-when">' + ev.when + '</span></span>';
            timeline.appendChild(item);
        });

        const errorWrap = document.getElementById('rd-drawer-error-wrap');
        if (row.lastError) {
            errorWrap.classList.remove('d-none');
            document.getElementById('rd-drawer-error').textContent = row.lastError;
        } else {
            errorWrap.classList.add('d-none');
        }

        const footer = document.getElementById('rd-drawer-footer');
        if (row.cancellable) {
            footer.classList.remove('d-none');
            document.getElementById('rd-drawer-send-form').action = rdSendBase + '/' + row.id + '/send-now';
            document.getElementById('rd-drawer-cancel-form').action = rdCancelBase + '/' + row.id + '/cancel';
        } else {
            footer.classList.add('d-none');
        }

        document.getElementById('rd-drawer-backdrop').classList.remove('d-none');
        document.getElementById('rd-drawer').classList.remove('d-none');
        document.body.style.overflow = 'hidden';
    }

    function rdCloseDrawer() {
        document.getElementById('rd-drawer-backdrop').classList.add('d-none');
        document.getElementById('rd-drawer').classList.add('d-none');
        document.body.style.overflow = '';
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') rdCloseDrawer();
    });
</script>
@endpush
