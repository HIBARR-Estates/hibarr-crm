<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $title }} {{ $number }}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            color: #1c2430;
            font-family: DejaVu Sans, sans-serif;
            font-size: 12px;
            line-height: 1.45;
        }
        .sheet { padding: 28px 32px 36px; }
        .brand {
            background: #16294d;
            color: #ffffff;
            padding: 22px 32px 18px;
        }
        .brand h1 {
            margin: 0;
            font-size: 20px;
            font-weight: normal;
            letter-spacing: 0.01em;
        }
        .brand p { margin: 4px 0 0; font-size: 11px; color: #d5deea; }
        .top { width: 100%; margin-top: 22px; border-collapse: collapse; }
        .top td { vertical-align: top; }
        .doc-title {
            text-align: right;
            color: #1a6bb5;
            font-size: 22px;
            letter-spacing: 0.08em;
            margin: 0;
        }
        .meta { margin-top: 8px; text-align: right; color: #5c6778; }
        .label {
            color: #5c6778;
            font-size: 10px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        .party { font-size: 13px; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 28px; }
        table.items th {
            text-align: left;
            background: #f4f6f8;
            color: #5c6778;
            font-size: 10px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            font-weight: normal;
            padding: 8px 10px;
            border-bottom: 1px solid #e3e7ee;
        }
        table.items td {
            padding: 12px 10px;
            border-bottom: 1px solid #e3e7ee;
            vertical-align: top;
        }
        .num { text-align: right; white-space: nowrap; }
        .total-wrap { width: 100%; margin-top: 8px; border-collapse: collapse; }
        .total-wrap td { padding: 4px 10px; }
        .total-label { text-align: right; color: #5c6778; }
        .total-value { text-align: right; font-size: 16px; font-weight: bold; color: #16294d; }
        .notes { margin-top: 28px; color: #5c6778; }
        .stamp {
            display: inline-block;
            margin-top: 10px;
            padding: 4px 10px;
            border: 2px solid #9aa3b2;
            color: #5c6778;
            letter-spacing: 0.14em;
            font-size: 12px;
        }
        .thanks { margin-top: 36px; color: #16294d; }
    </style>
</head>
<body>
    <div class="brand">
        <h1>{{ $company_name }}</h1>
        @if (count($company_lines))
            <p>{!! nl2br(e(implode("\n", $company_lines))) !!}</p>
        @endif
    </div>

    <div class="sheet">
        <table class="top">
            <tr>
                <td style="width: 55%;">
                    <div class="label">{{ $party_label }}</div>
                    <div class="party">
                        @forelse ($party_lines as $line)
                            {{ $line }}@if (!$loop->last)<br>@endif
                        @empty
                            —
                        @endforelse
                    </div>
                </td>
                <td>
                    <div class="doc-title">{{ strtoupper($title) }}</div>
                    <div class="meta">
                        {{ __('pages.payment_requests.document.number') }} {{ $number }}<br>
                        @if ($issued_on)
                            {{ __('pages.payment_requests.document.date') }} {{ $issued_on }}<br>
                        @endif
                        @if ($reference)
                            {{ __('pages.payment_requests.document.reference') }} {{ $reference }}
                        @endif
                    </div>
                    @if ($stamp)
                        <div style="text-align: right;"><span class="stamp">{{ strtoupper($stamp) }}</span></div>
                    @endif
                </td>
            </tr>
        </table>

        <table class="items">
            <thead>
                <tr>
                    <th>{{ __('pages.payment_requests.document.description') }}</th>
                    <th>{{ __('pages.payment_requests.document.status') }}</th>
                    <th>{{ __('pages.payment_requests.document.method') }}</th>
                    <th class="num">{{ __('pages.payment_requests.document.amount') }}</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        {{ $description }}
                        @if ($deal_name)
                            <div style="color: #5c6778; margin-top: 2px;">{{ $deal_name }}</div>
                        @endif
                    </td>
                    <td>{{ $status }}</td>
                    <td>{{ $method }}</td>
                    <td class="num">{{ $amount }}</td>
                </tr>
            </tbody>
        </table>

        <table class="total-wrap">
            @if ($base_amount)
                <tr>
                    <td class="total-label">{{ __('pages.payment_requests.document.deal_value') }}</td>
                    <td class="num" style="width: 160px;">{{ $base_amount }}</td>
                </tr>
            @endif
            @if ($rate)
                <tr>
                    <td class="total-label">{{ __('pages.payment_requests.document.rate') }}</td>
                    <td class="num">{{ $rate }}</td>
                </tr>
            @endif
            <tr>
                <td class="total-label">{{ __('pages.payment_requests.document.total') }}</td>
                <td class="total-value">{{ $amount }}</td>
            </tr>
        </table>

        <div class="thanks">{{ __('pages.payment_requests.document.thanks') }}</div>
    </div>
</body>
</html>
