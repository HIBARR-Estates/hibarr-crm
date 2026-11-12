@php
    /*
     * KKTC Fatura (A4 portrait) and Tahsilat Makbuzu (A5 landscape).
     * Legal labels are Turkish whatever the app locale; English sub-labels
     * are shown when the company turns bilingual labels on.
     * Built with tables only, since dompdf has no flexbox or grid.
     */
    $isInvoice = $kind === 'invoice';
    $brand = $brand_color;
    $en = fn (string $text) => $bilingual ? '<span class="en">' . e($text) . '</span>' : '';
    $seller = $seller ?? [];
    $buyer = $buyer ?? ['name' => null, 'lines' => []];
    $methods = [
        'cash' => 'Nakit',
        'cheque' => 'Çek',
        'transfer' => 'Havale / EFT',
        'card' => 'Kart',
        'crypto' => 'Kripto',
    ];
@endphp
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8">
    <title>{{ $title }} {{ $number }}</title>
    {{-- This app's dompdf only reads font metrics from storage/fonts, so the
         bundled DejaVu fonts are registered here (dompdf copies them there on
         first use). Without this every render fails on the first glyph. --}}
    <style>
        @font-face { font-family: 'KktcSans'; font-weight: normal; font-style: normal; src: url("{{ base_path('vendor/dompdf/dompdf/lib/fonts/DejaVuSans.ttf') }}") format('truetype'); }
        @font-face { font-family: 'KktcSans'; font-weight: bold; font-style: normal; src: url("{{ base_path('vendor/dompdf/dompdf/lib/fonts/DejaVuSans-Bold.ttf') }}") format('truetype'); }
        @font-face { font-family: 'KktcSans'; font-weight: normal; font-style: italic; src: url("{{ base_path('vendor/dompdf/dompdf/lib/fonts/DejaVuSans-Oblique.ttf') }}") format('truetype'); }
        @font-face { font-family: 'KktcSans'; font-weight: bold; font-style: italic; src: url("{{ base_path('vendor/dompdf/dompdf/lib/fonts/DejaVuSans-BoldOblique.ttf') }}") format('truetype'); }
        @font-face { font-family: 'KktcMono'; font-weight: normal; font-style: normal; src: url("{{ base_path('vendor/dompdf/dompdf/lib/fonts/DejaVuSansMono.ttf') }}") format('truetype'); }
        @font-face { font-family: 'KktcMono'; font-weight: bold; font-style: normal; src: url("{{ base_path('vendor/dompdf/dompdf/lib/fonts/DejaVuSansMono-Bold.ttf') }}") format('truetype'); }
        @page { margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #1a2129; font-family: 'KktcSans', DejaVu Sans, sans-serif; font-size: 9.5px; line-height: 1.4; }
        table { border-collapse: collapse; width: 100%; }
        td, th { vertical-align: top; padding: 0; }
        .band { background: {{ $brand }}; height: 6px; }
        .page { padding: 28px 40px 0; }
        .rct .page { padding: 20px 30px 0 34px; }
        .rct-band { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: {{ $brand }}; }
        .label { font-size: 7px; font-weight: bold; letter-spacing: 0.8px; color: #8b949e; }
        .en { font-weight: normal; letter-spacing: 0.2px; text-transform: none; color: #8b949e; font-size: 7px; }
        .muted { color: #56606b; }
        .faint { color: #8b949e; }
        .num { text-align: right; white-space: nowrap; }
        .logo { max-height: 52px; max-width: 200px; }
        .seller-name { font-size: 12.5px; font-weight: bold; }
        .seller-lines { font-size: 8.5px; color: #56606b; line-height: 1.55; }
        .seller-lines b { color: #1a2129; }
        .title { color: {{ $brand }}; font-weight: bold; letter-spacing: 3px; line-height: 1; }
        .title-en { display: block; font-size: 7.5px; letter-spacing: 1.5px; color: #8b949e; font-weight: normal; margin-top: 4px; }
        .serial { font-family: 'KktcMono', DejaVu Sans Mono, monospace; font-weight: bold; letter-spacing: 1px; }
        .copy-mark { display: inline-block; border: 1px solid {{ $brand }}; color: {{ $brand }}; font-size: 7.5px; font-weight: bold; letter-spacing: 1.2px; padding: 2px 6px; }
        .stamp { display: inline-block; border: 2px solid #a3341f; color: #a3341f; font-size: 12px; font-weight: bold; letter-spacing: 3px; padding: 3px 10px; }
        .box { border: 1px solid #c9d0d7; padding: 8px 10px; }
        .meta td { padding: 2px 0 2px 14px; font-size: 9px; }
        .meta td.k { padding-left: 0; }
        .items th { background: {{ $brand }}; color: #ffffff; text-align: left; font-size: 7.5px; letter-spacing: 0.8px; padding: 6px 8px; }
        .items th .en { color: #dfe6ea; display: block; text-transform: none; letter-spacing: 0.2px; }
        .items td { padding: 8px; border-bottom: 1px solid #c9d0d7; font-size: 9.5px; }
        .items tr.blank td { height: 18px; border-bottom: 1px dashed #e1e5e9; }
        .items .detail { color: #8b949e; font-size: 8px; margin-top: 2px; }
        .totals td { padding: 6px 10px; border-bottom: 1px solid #c9d0d7; font-size: 10px; }
        .totals .grand td { background: {{ $brand }}; color: #ffffff; border: 0; font-weight: bold; font-size: 12px; padding: 8px 10px; }
        .words { background: #f3f5f7; padding: 7px 10px; font-size: 9px; }
        .words b { font-size: 9.5px; }
        .bank td { font-size: 8.5px; padding: 1px 10px 1px 0; }
        .mono { font-family: 'KktcMono', DejaVu Sans Mono, monospace; font-size: 8.5px; }
        .approval { font-size: 7px; color: #8b949e; line-height: 1.45; }
        .approval b { color: #56606b; }
        .sig-line { border-bottom: 1px solid #56606b; height: 34px; }
        .sig-who { font-size: 8px; color: #56606b; padding-top: 2px; }
        .footer { border-top: 1px solid #c9d0d7; padding-top: 6px; font-size: 7px; color: #8b949e; }
        .amount-box td { border: 1.5px solid {{ $brand }}; }
        .amount-box .cur { background: {{ $brand }}; color: #ffffff; font-weight: bold; font-size: 10px; letter-spacing: 1px; text-align: center; vertical-align: middle; width: 48px; }
        .amount-box .amt { font-size: 17px; font-weight: bold; text-align: right; padding: 6px 10px; }
        .amount-box .amt small { display: block; font-size: 7px; color: #8b949e; font-weight: normal; }
        .statement { font-size: 10px; line-height: 1.75; }
        .fill { border-bottom: 1px solid #c9d0d7; font-weight: bold; }
        .pay td { border: 1px solid #c9d0d7; padding: 6px 10px; font-size: 9px; }
        .chks { width: auto; margin-top: 4px; }
        .pay .chks td { vertical-align: middle; border: 0; padding: 0; }
        .pay .chks td.chk { width: 11px; }
        .chk .b { width: 9px; height: 9px; border: 1px solid #56606b; text-align: center; font-size: 7px; line-height: 9px; color: #ffffff; }
        .chk.on .b { background: {{ $brand }}; border-color: {{ $brand }}; }
        .pay .chks td.chk-label { padding: 0 9px 0 3px; font-size: 8.5px; color: #56606b; white-space: nowrap; }
        .chk-label.on { color: #1a2129; font-weight: bold; }
    </style>
</head>
<body class="{{ $isInvoice ? 'inv' : 'rct' }}">

{{-- Approval marks: stamp duty box, tax office seal area, approval number and range. --}}
@php
    // The stamp duty box and the tax office seal are images, drawn from
    // resources/pdf/kktc/marks-source.html: dompdf can't set text on a curve.
    $markImage = fn (string $file) => 'data:image/png;base64,' . base64_encode((string) @file_get_contents(resource_path('pdf/kktc/' . $file)));
    // Sits top right, above the title: badges, then the approval number and range.
    $marks = function (int $sealSize) use ($approval, $markImage) {
        $badges = '';
        if (! empty($approval['show_stamp_duty'])) {
            $width = (int) round($sealSize * 1.22);
            $badges .= '<td style="padding-left:10px;vertical-align:middle"><img src="' . $markImage('kktc-stamp-duty.png') . '" style="width:' . $width . 'px;height:' . (int) round($width * 336 / 720) . 'px" alt="KKTC Damga Vergisi Ödenmiştir"></td>';
        }
        if (! empty($approval['show_seal'])) {
            $badges .= '<td style="padding-left:10px;vertical-align:middle"><img src="' . $markImage('kktc-approval-seal.png') . '" style="width:' . $sealSize . 'px;height:' . $sealSize . 'px" alt="Gelir ve Vergi Dairesi belge onayı"></td>';
        }
        $lines = [];
        if (! empty($approval['number'])) {
            $lines[] = '<b>Belge onay no:</b><br>' . e($approval['number']);
        }
        if (! empty($approval['range'])) {
            $lines[] = '<b>Seri aralığı:</b><br>' . e($approval['range']);
        }
        if ($badges === '' && ! $lines) {
            return '';
        }
        $text = $lines ? '<td style="vertical-align:middle;text-align:right"><div class="approval">' . implode('<br>', $lines) . '</div></td>' : '';

        return '<table style="width:auto;margin:0 0 0 auto"><tr>' . $text . $badges . '</tr></table>';
    };
@endphp

@if ($isInvoice)
    <div class="band"></div>
    <div class="page">
        {{-- Header: seller left, title and numbers right --}}
        <table>
            <tr>
                <td style="width:58%">
                    @if ($logo_data_uri)
                        <img class="logo" src="{{ $logo_data_uri }}" alt="">
                        <div style="height:10px"></div>
                    @endif
                    <div class="seller-name">{{ $seller['legal_name'] ?: config('app.name') }}</div>
                    <div class="seller-lines">
                        @if ($seller['address']){!! nl2br(e($seller['address'])) !!}<br>@endif
                        {{ collect([$seller['phone'] ? 'Tel: ' . $seller['phone'] : null, $seller['email']])->filter()->implode(' · ') }}
                    </div>
                    <div class="seller-lines" style="margin-top:6px">
                        @if ($seller['tax_office'])<b>Vergi Dairesi:</b> {{ $seller['tax_office'] }} &nbsp;·&nbsp; @endif
                        <b>Vergi Sicil No:</b> {{ $seller['tax_number'] ?: '—' }}
                        @if ($seller['registration_number'])<br><b>Şirket Sicil No:</b> {{ $seller['registration_number'] }}@endif
                    </div>
                </td>
                <td style="text-align:right">
                    @php($marksHtml = $marks(66))
                    @if ($marksHtml)<div style="margin-bottom:12px">{!! $marksHtml !!}</div>@endif
                    <div class="title" style="font-size:26px">{{ $title }}@if ($bilingual)<span class="title-en">{{ strtoupper($title_en) }}</span>@endif</div>
                    <div style="margin-top:8px"><span class="copy-mark">{{ $copy_label['tr'] }}@if ($bilingual) · {{ strtoupper($copy_label['en']) }}@endif</span></div>
                    @if ($stamp)
                        <div style="margin-top:8px"><span class="stamp">{{ $stamp['tr'] }}</span></div>
                    @endif
                    <table class="meta" style="width:auto;margin:10px 0 0 auto;border-top:1px solid #c9d0d7">
                        <tr><td class="k"><span class="label">SERİ / SIRA NO</span> {!! $en('No.') !!}</td><td class="serial" style="font-size:12px">№ {{ $number }}</td></tr>
                        <tr><td class="k"><span class="label">TARİH</span> {!! $en('Date') !!}</td><td>{{ $issued_on }}</td></tr>
                        @if ($due_on)
                            <tr><td class="k"><span class="label">VADE</span> {!! $en('Due') !!}</td><td>{{ $due_on }}</td></tr>
                        @endif
                        @if ($reference)
                            <tr><td class="k"><span class="label">REFERANS</span> {!! $en('Ref.') !!}</td><td>{{ $reference }}</td></tr>
                        @endif
                    </table>
                </td>
            </tr>
        </table>

        {{-- Buyer and subject --}}
        <table style="margin-top:16px">
            <tr>
                <td style="width:56%;padding-right:14px">
                    <div class="box">
                        <span class="label">SAYIN / ALICI</span> {!! $en('Billed to') !!}
                        <div style="font-size:11px;font-weight:bold;margin-top:3px">{{ $buyer['name'] ?: '—' }}</div>
                        @if (! empty($buyer['lines']))
                            <div class="muted" style="font-size:8.5px">Adresi: {{ implode(', ', $buyer['lines']) }}</div>
                        @else
                            <div class="muted" style="font-size:8.5px">Adresi: ..............................................................</div>
                        @endif
                        @if (! empty($buyer['tax_id']))
                            <div class="muted" style="font-size:8.5px">Vergi / Kimlik No: {{ $buyer['tax_id'] }}</div>
                        @endif
                    </div>
                </td>
                <td>
                    <div class="box">
                        <span class="label">KONU</span> {!! $en('Subject') !!}
                        <div style="font-size:11px;font-weight:bold;margin-top:3px">{{ $deal_name ?: '—' }}</div>
                    </div>
                </td>
            </tr>
        </table>

        {{-- Line items --}}
        <table class="items" style="margin-top:16px">
            <thead>
                <tr>
                    <th style="width:24px">#</th>
                    <th>AÇIKLAMA {!! $en('Description') !!}</th>
                    <th class="num" style="width:56px;text-align:right">MİKTAR {!! $en('Qty') !!}</th>
                    <th class="num" style="width:96px;text-align:right">@ BİRİM {!! $en('Unit price') !!}</th>
                    <th class="num" style="width:104px;text-align:right">TUTAR {!! $en('Amount') !!}</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($lines_display as $i => $line)
                    <tr>
                        <td class="faint">{{ $i + 1 }}</td>
                        <td>{{ $line['description'] }}@if ($line['detail'])<div class="detail">{{ $line['detail'] }}</div>@endif</td>
                        <td class="num">{{ $line['quantity'] }}</td>
                        <td class="num">{{ $line['unit_price_display'] }}</td>
                        <td class="num">{{ $line['total_display'] }}</td>
                    </tr>
                @endforeach
                @for ($i = count($lines_display); $i < 4; $i++)
                    <tr class="blank"><td></td><td></td><td></td><td></td><td></td></tr>
                @endfor
            </tbody>
        </table>

        {{-- Words, bank details, totals --}}
        <table style="margin-top:14px">
            <tr>
                <td style="padding-right:22px">
                    <div class="words"><span class="label">YAZI İLE</span> {!! $en('In words') !!}<br><b>{{ $amount_in_words }}</b></div>
                    @if ($bank['name'] || $bank['iban'])
                        <div class="box" style="margin-top:10px">
                            <span class="label">ÖDEME BİLGİLERİ</span> {!! $en('Payment details') !!}
                            <table class="bank" style="margin-top:4px">
                                @if ($bank['name'])<tr><td class="faint" style="width:70px">Banka</td><td>{{ $bank['name'] }}</td></tr>@endif
                                @if ($bank['account_name'])<tr><td class="faint">Hesap adı</td><td>{{ $bank['account_name'] }}</td></tr>@endif
                                @if ($bank['iban'])<tr><td class="faint">IBAN</td><td class="mono">{{ $bank['iban'] }}</td></tr>@endif
                                @if ($bank['swift'])<tr><td class="faint">SWIFT</td><td class="mono">{{ $bank['swift'] }}</td></tr>@endif
                                <tr><td class="faint">Açıklama</td><td class="mono">{{ $number }}</td></tr>
                            </table>
                        </div>
                    @endif
                </td>
                <td style="width:236px">
                    <table class="totals">
                        <tr><td class="muted">Ara Toplam @if ($bilingual)<span class="en">Subtotal</span>@endif</td><td class="num">{{ $subtotal_display }}</td></tr>
                        <tr><td class="muted">KDV %{{ $vat_rate_display }} @if ($bilingual)<span class="en">VAT</span>@endif</td><td class="num">{{ $vat_display }}</td></tr>
                        <tr class="grand"><td style="white-space:nowrap;font-size:10px;letter-spacing:0.6px">GENEL TOPLAM</td><td class="num">{{ $currency_prefix }}{{ $total_display }} {{ $currency_label }}</td></tr>
                    </table>
                    @if ($try_display)
                        <div class="faint" style="text-align:right;font-size:7.5px;margin-top:5px">
                            TL karşılığı: {{ $try_display['amount'] }} TL<br>
                            1 {{ $currency_label }} = {{ $try_display['rate'] }} TL · ECB referans kuru {{ $try_display['date'] }}
                        </div>
                    @endif
                </td>
            </tr>
        </table>
    </div>

    {{-- Footer pinned to the bottom of the A4 page --}}
    <div style="position:absolute;left:40px;right:40px;bottom:26px">
        <table>
            <tr>
                <td style="vertical-align:bottom">
                    <div class="sig-line"></div>
                    <span class="label">TESLİM EDEN</span> {!! $en('Issued by') !!}
                    <div class="sig-who">{{ $seller['legal_name'] }} · kaşe / imza</div>
                </td>
                <td style="padding-left:40px;vertical-align:bottom">
                    <div class="sig-line"></div>
                    <span class="label">TESLİM ALAN</span> {!! $en('Received by') !!}
                    <div class="sig-who">{{ $buyer['name'] ? $buyer['name'].' · ' : '' }}imza</div>
                </td>
            </tr>
        </table>
        <div class="footer" style="margin-top:12px">
            <table><tr>
                <td>{{ $footer_note }}</td>
                <td class="num" style="width:60px">Sayfa 1 / 1</td>
            </tr></table>
        </div>
    </div>
@else
    <div class="rct-band"></div>
    <div class="page">
        <table>
            <tr>
                <td>
                    <table style="width:auto"><tr>
                        @if ($logo_data_uri)
                            <td style="padding-right:10px;vertical-align:middle"><img class="logo" style="max-height:40px;max-width:140px" src="{{ $logo_data_uri }}" alt=""></td>
                        @endif
                        <td style="vertical-align:middle">
                            <div class="seller-name" style="font-size:11.5px">{{ $seller['legal_name'] ?: config('app.name') }}</div>
                            <div class="seller-lines">
                                {{ collect([$seller['address'] ? str_replace(["\r\n", "\n"], ', ', $seller['address']) : null, $seller['phone'] ? 'Tel: ' . $seller['phone'] : null])->filter()->implode(' · ') }}<br>
                                @if ($seller['tax_office'])<b>Vergi Dairesi:</b> {{ $seller['tax_office'] }} · @endif<b>Vergi Sicil No:</b> {{ $seller['tax_number'] ?: '—' }}
                            </div>
                        </td>
                    </tr></table>
                </td>
                <td style="text-align:right;width:300px">
                    @php($marksHtml = $marks(52))
                    @if ($marksHtml)<div style="margin-bottom:8px">{!! $marksHtml !!}</div>@endif
                    <div class="title" style="font-size:14px;letter-spacing:2px">{{ $title }}@if ($bilingual)<span class="title-en">{{ strtoupper($title_en) }}</span>@endif</div>
                    <div class="serial" style="font-size:13px;margin-top:6px">№ {{ $number }}</div>
                    <div style="margin-top:3px"><span class="label">TARİH</span> {!! $en('Date') !!} &nbsp;{{ $issued_on }}</div>
                    @if ($stamp)
                        <div style="margin-top:6px"><span class="stamp">{{ $stamp['tr'] }}</span></div>
                    @endif
                </td>
            </tr>
        </table>

        <table style="margin-top:14px">
            <tr>
                <td class="statement" style="padding-right:20px">
                    <span class="label">SAYIN</span> {!! $en('Received from') !!}<br>
                    <span class="fill">{{ $payer_ablative ?: '..............................' }}</span>,
                    @if ($invoice_number)
                        <span class="fill">{{ $invoice_number }} no.lu fatura</span>
                    @endif
                    @if ($deal_name)({{ $deal_name }})@endif
                    karşılığı olarak aşağıda yazılı tutar tahsil edilmiştir.
                </td>
                <td style="width:200px">
                    <table class="amount-box">
                        <tr>
                            <td class="cur">{{ $currency_label }}</td>
                            <td class="amt">{{ $total_display }}@if ($try_display)<small>TL karşılığı {{ $try_display['amount'] }} TL</small>@endif</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <div class="words" style="margin-top:12px"><span class="label">YAZI İLE</span> {!! $en('In words') !!}<br><b>{{ $amount_in_words }}</b></div>

        <table class="pay" style="margin-top:12px">
            <tr>
                <td style="width:44%">
                    <span class="label">ÖDEME ŞEKLİ</span> {!! $en('Method') !!}
                    {{-- A table, not inline-blocks: dompdf misplaces inline-block boxes. --}}
                    <table class="chks"><tr>
                        @foreach ($methods as $key => $label)
                            <td class="chk {{ $method === $key ? 'on' : '' }}"><div class="b">{{ $method === $key ? '✓' : '' }}</div></td>
                            <td class="chk-label {{ $method === $key ? 'on' : '' }}">{{ $label }}</td>
                        @endforeach
                    </tr></table>
                </td>
                <td>
                    <span class="label">BANKA</span> {!! $en('Bank') !!}<br>
                    {{ in_array($method, ['transfer', 'cheque'], true) ? ($bank['name'] ?: '—') : '—' }}
                </td>
                <td>
                    <span class="label">ÇEK / DEKONT / İŞLEM NO</span> {!! $en('Ref.') !!}<br>
                    <span class="mono">{{ $transaction_reference ?: ($reference ?: '—') }}</span>
                </td>
            </tr>
        </table>
    </div>

    <div style="position:absolute;left:34px;right:30px;bottom:18px">
        <table>
            <tr>
                <td style="vertical-align:bottom">
                    <span class="copy-mark">{{ $copy_label['tr'] }}@if ($bilingual) · {{ strtoupper($copy_label['en']) }}@endif</span>
                    @if ($footer_note)<div class="approval" style="margin-top:4px">{{ $footer_note }}</div>@endif
                </td>
                <td style="width:200px;vertical-align:bottom">
                    <div class="sig-line"></div>
                    <span class="label">PARAYI ALAN</span> {!! $en('Received by') !!}
                    <div class="sig-who">{{ collect([$received_by, $seller['legal_name']])->filter()->implode(', ') }} · kaşe / imza</div>
                </td>
            </tr>
        </table>
    </div>
@endif
</body>
</html>
