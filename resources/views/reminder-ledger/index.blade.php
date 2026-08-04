@extends('layouts.app')

@section('content')

@php
    $tab = $filters['tab'] ?? 'all';
    $search = $filters['search'] ?? '';
    $entityType = $filters['entity_type'] ?? '';
    $queryBase = array_filter([
        'search' => $search !== '' ? $search : null,
        'entity_type' => $entityType !== '' ? $entityType : null,
        'per_page' => $filters['per_page'] ?? null,
    ], fn ($v) => $v !== null && $v !== '');

    $tabs = [
        ['key' => 'all', 'label' => 'All'],
        ['key' => 'delayed', 'label' => 'Delayed'],
        ['key' => 'sent', 'label' => 'Sent'],
        ['key' => 'cancelled', 'label' => 'Cancelled'],
        ['key' => 'failed', 'label' => 'Failed'],
    ];
@endphp

<div class="w-100 d-flex">
    <x-setting-sidebar :activeMenu="$activeSettingMenu" />

    <div class="w-100" style="background:#f4f5f7; min-height:100vh; overflow:auto;">
        <div style="font-family:'IBM Plex Sans', system-ui, sans-serif; color:#1a202c; padding:32px 40px 64px;">
            <div style="max-width:1240px; margin:0 auto; display:flex; flex-direction:column; gap:20px;">

                <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap;">
                    <div>
                        <h1 style="margin:0; font-size:24px; font-weight:700; letter-spacing:-0.02em;">Reminders</h1>
                        <p style="margin:4px 0 0; font-size:14px; color:#667085;">Scheduled and sent reminder emails for this company</p>
                    </div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap;">
                        <div style="background:#fff; border:1px solid #e4e7ec; border-radius:10px; padding:10px 16px; min-width:96px;">
                            <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#667085;">Sent</div>
                            <div style="font-size:20px; font-weight:700; color:#067647;">{{ $stats['sent'] }}</div>
                        </div>
                        <div style="background:#fff; border:1px solid #e4e7ec; border-radius:10px; padding:10px 16px; min-width:96px;">
                            <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#667085;">Delayed</div>
                            <div style="font-size:20px; font-weight:700; color:#b54708;">{{ $stats['delayed'] }}</div>
                        </div>
                        <div style="background:#fff; border:1px solid #e4e7ec; border-radius:10px; padding:10px 16px; min-width:96px;">
                            <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#667085;">Cancelled</div>
                            <div style="font-size:20px; font-weight:700; color:#475467;">{{ $stats['cancelled'] }}</div>
                        </div>
                        <div style="background:#fff; border:1px solid #e4e7ec; border-radius:10px; padding:10px 16px; min-width:96px;">
                            <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#667085;">Failed</div>
                            <div style="font-size:20px; font-weight:700; color:#b42318;">{{ $stats['failed'] }}</div>
                        </div>
                    </div>
                </div>

                @if ($showDelayBanner)
                    <div style="display:flex; align-items:center; gap:10px; background:#fffaeb; border:1px solid #fedf89; border-radius:10px; padding:10px 16px; font-size:13.5px; color:#93370d;">
                        <span style="width:8px; height:8px; border-radius:50%; background:#f79009; flex-shrink:0;"></span>
                        <span><strong style="font-weight:600;">{{ $delayBannerText }}</strong> — delivery ran behind schedule earlier today. Worst delay: {{ $worstDelay }}.</span>
                    </div>
                @endif

                <div style="background:#fff; border:1px solid #e4e7ec; border-radius:12px; overflow:hidden; overflow-x:auto;">
                    <div style="display:flex; align-items:center; gap:4px; padding:8px 16px 0; border-bottom:1px solid #e4e7ec;">
                        @foreach ($tabs as $item)
                            @php
                                $active = $tab === $item['key'];
                                $count = (int) ($tabCounts[$item['key']] ?? 0);
                            @endphp
                            <a href="{{ route('reminder-ledger.index', array_merge($queryBase, ['tab' => $item['key']])) }}"
                               style="text-decoration:none; appearance:none; background:none; border:none; border-bottom:2px solid {{ $active ? '#2563eb' : 'transparent' }}; padding:10px 12px 12px; font-family:inherit; font-size:14px; font-weight:{{ $active ? '600' : '500' }}; color:{{ $active ? '#1a202c' : '#667085' }}; cursor:pointer; display:flex; align-items:center; gap:7px;">
                                {{ $item['label'] }}
                                <span style="font-size:12px; font-weight:600; background:{{ $active ? '#eff8ff' : '#f2f4f7' }}; color:{{ $active ? '#175cd3' : '#475467' }}; border-radius:999px; padding:1px 8px;">{{ $count }}</span>
                            </a>
                        @endforeach
                    </div>

                    <form method="GET" action="{{ route('reminder-ledger.index') }}" style="display:flex; align-items:center; gap:12px; padding:14px 16px; border-bottom:1px solid #e4e7ec; background:#fcfcfd; flex-wrap:wrap;">
                        <input type="hidden" name="tab" value="{{ $tab }}">
                        <input type="hidden" name="per_page" value="{{ $filters['per_page'] ?? 25 }}">
                        <input type="text"
                               name="search"
                               value="{{ $search }}"
                               placeholder="Search message, email, or entity…"
                               style="flex:1; max-width:340px; font-family:inherit; font-size:14px; color:#1a202c; background:#fff; border:1px solid #d0d5dd; border-radius:8px; padding:8px 12px; outline:none;">
                        <select name="entity_type"
                                onchange="this.form.submit()"
                                style="font-family:inherit; font-size:14px; color:#1a202c; background:#fff; border:1px solid #d0d5dd; border-radius:8px; padding:8px 10px; outline:none; cursor:pointer;">
                            <option value="">All types</option>
                            @foreach ($entityTypes as $type)
                                <option value="{{ $type }}" @selected($entityType === $type)>
                                    {{ str_replace('_', ' ', ucfirst($type)) }}
                                </option>
                            @endforeach
                        </select>
                        <button type="submit" style="appearance:none; background:#2563eb; color:#fff; border:none; border-radius:8px; font-family:inherit; font-size:13.5px; font-weight:600; cursor:pointer; padding:8px 14px;">Apply</button>
                        @if ($hasFilters)
                            <a href="{{ route('reminder-ledger.index') }}" style="appearance:none; background:none; border:none; font-family:inherit; font-size:13.5px; font-weight:500; color:#1d4ed8; cursor:pointer; padding:8px 4px; text-decoration:none;">Reset</a>
                        @endif
                        <div style="margin-left:auto; font-size:13px; color:#667085;">
                            @if ($reminders->total() === 0)
                                0 results
                            @else
                                {{ $reminders->firstItem() }}–{{ $reminders->lastItem() }} of {{ $reminders->total() }}
                            @endif
                        </div>
                    </form>

                    <div style="display:grid; grid-template-columns:170px minmax(140px, 1.4fr) minmax(150px, 1fr) 90px 105px 105px; min-width:780px; padding:0 16px; border-bottom:1px solid #e4e7ec; background:#fcfcfd;">
                        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#667085; padding:10px 8px;">Entity</div>
                        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#667085; padding:10px 8px;">Message</div>
                        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#667085; padding:10px 8px;">Recipient</div>
                        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#667085; padding:10px 8px;">Remind at</div>
                        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#667085; padding:10px 8px;">Delivery</div>
                        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:#667085; padding:10px 8px; text-align:right;">Status</div>
                    </div>

                    @forelse ($groups as $group)
                        <div>
                            <div style="display:flex; align-items:center; gap:10px; padding:10px 24px; background:#f8f9fb; border-bottom:1px solid #e4e7ec;">
                                <span style="font-size:13px; font-weight:600; color:#344054;">{{ $group['label'] }}</span>
                                <span style="font-size:12.5px; color:#98a2b3;">{{ $group['sub'] }}</span>
                            </div>
                            @foreach ($group['rows'] as $r)
                                <div class="rd-row" style="display:grid; grid-template-columns:170px minmax(140px, 1.4fr) minmax(150px, 1fr) 90px 105px 105px; min-width:780px; align-items:center; padding:0 16px; border-bottom:1px solid #eef0f3;">
                                    <div style="padding:11px 8px; display:flex; align-items:center; gap:8px;">
                                        <span style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; background:{{ $r['chipBg'] }}; color:{{ $r['chipColor'] }}; border-radius:6px; padding:3px 8px;">{{ $r['chipLabel'] }}</span>
                                        <span style="font-family:'IBM Plex Mono', monospace; font-size:12px; color:#98a2b3;">#{{ $r['entity_id'] }}</span>
                                    </div>
                                    <div style="padding:11px 8px; font-size:14px; color:#344054; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="{{ $r['msg'] }}">{{ $r['msg'] }}</div>
                                    <div style="padding:11px 8px; display:flex; align-items:center; gap:9px; overflow:hidden;">
                                        <span style="width:26px; height:26px; border-radius:50%; background:{{ $r['avatarBg'] }}; color:{{ $r['avatarColor'] }}; font-size:11px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">{{ $r['initials'] }}</span>
                                        <span style="min-width:0;">
                                            <span style="display:block; font-size:13.5px; font-weight:500; color:#344054; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ $r['name'] }}</span>
                                            <span style="display:block; font-size:12px; color:#98a2b3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ $r['email'] }}</span>
                                        </span>
                                    </div>
                                    <div style="padding:11px 8px; font-size:13.5px; color:#344054; font-variant-numeric:tabular-nums;">{{ $r['timeText'] }}</div>
                                    <div style="padding:11px 8px; font-size:13px; font-weight:{{ $r['deliveryWeight'] }}; color:{{ $r['deliveryColor'] }};">{{ $r['deliveryText'] }}</div>
                                    <div style="padding:11px 8px; display:flex; justify-content:flex-end;">
                                        <span style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:500; background:{{ $r['statusBg'] }}; color:{{ $r['statusColor'] }}; border-radius:999px; padding:3px 10px;">
                                            <span style="width:6px; height:6px; border-radius:50%; background:{{ $r['dotColor'] }};"></span>
                                            {{ $r['statusLabel'] }}
                                        </span>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    @empty
                        <div style="padding:48px 24px; text-align:center;">
                            <div style="font-size:15px; font-weight:600; color:#344054;">No reminders match</div>
                            <div style="font-size:13.5px; color:#667085; margin-top:4px;">Try clearing the search or switching tabs.</div>
                        </div>
                    @endforelse

                    @if ($reminders->hasPages())
                        <div style="padding:16px; display:flex; justify-content:center; border-top:1px solid #e4e7ec; background:#fcfcfd;">
                            {{ $reminders->onEachSide(1)->links('pagination::bootstrap-4') }}
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>

@endsection

@push('styles')
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
    .rd-row:hover { background: #f8fafc; }
    .setting-sidebar + div .pagination { margin-bottom: 0; }
</style>
@endpush
