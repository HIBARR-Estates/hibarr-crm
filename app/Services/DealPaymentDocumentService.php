<?php

namespace App\Services;

use App\Models\Currency;
use App\Models\Deal;
use App\Models\Payment;
use App\Models\PaymentDocument;
use App\Models\PaymentDocumentSetting;
use App\Scopes\CompanyScope;
use App\Support\Kktc\TurkishAmountInWords;
use App\Support\Kktc\TurkishSuffix;
use Carbon\CarbonInterface;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * KKTC invoices (Fatura) and collection receipts (Tahsilat Makbuzu) for a deal
 * payment request.
 *
 * An invoice can be issued for any live request. A receipt exists only once
 * the payment has been collected, and always refers to the request's invoice.
 *
 * A document is issued the first time it is generated: it takes the next
 * number from the company's configured range and stores a snapshot of what
 * was printed. Every later download renders that snapshot, so the number,
 * date, seller details and amounts never change after issue. Only the logo,
 * brand colour and label language follow the current settings.
 */
class DealPaymentDocumentService
{
    public const KINDS = [PaymentDocument::INVOICE, PaymentDocument::RECEIPT];

    public const COPIES = ['original', 'copy'];

    public function __construct(
        private readonly ExchangeRateService $exchangeRates,
    ) {}

    /**
     * Issues the document if needed and returns the data the PDF view renders.
     *
     * @return array<string, mixed>
     */
    public function viewData(Payment $payment, string $kind, string $copy = 'original'): array
    {
        $this->assertKind($kind);

        $uiState = DealPaymentService::uiStateOf($payment);
        if ($kind === PaymentDocument::RECEIPT && ! in_array($uiState, ['confirmed', 'paid_online'], true)) {
            throw new HttpException(409, 'A receipt is available once the payment has been collected.');
        }

        $document = $this->issue($payment, $kind);
        $settings = PaymentDocumentSetting::forCompany((int) $payment->company_id);

        return $this->present($document->snapshot, $settings, $copy, $this->stampFor($uiState));
    }

    public function download(Payment $payment, string $kind, string $copy = 'original')
    {
        return $this->pdf($this->viewData($payment, $kind, $copy))->download($this->filename($kind, $payment));
    }

    /**
     * A sample document built from the given settings, for the settings page.
     * It shows the next number in the range without taking it.
     *
     * @return array<string, mixed>
     */
    public function previewData(PaymentDocumentSetting $settings, string $kind): array
    {
        $this->assertKind($kind);

        $issuedAt = now();
        $series = $this->seriesFor($settings, $kind);
        $sequence = $this->nextSequence($settings, $kind, $series);

        $snapshot = $this->snapshot($settings, $kind, [
            'number' => PaymentDocument::formatNumber($series, $sequence, $settings->number_padding),
            'issued_at' => $issuedAt,
            'buyer' => [
                'name' => 'Markus Weber',
                'lines' => ['Lindenstraße 18, 10969 Berlin', 'Almanya'],
                'tax_id' => null,
            ],
            'deal_name' => 'Esentepe Bay Residences, Blok B Daire 14',
            'reference' => 'PR-1042',
            'amount' => 4350.00,
            'currency_code' => 'GBP',
            'currency_symbol' => '£',
            'method' => 'transfer',
            'transaction_reference' => 'EFT-20261119-7781',
            'received_by' => user()?->name,
            'invoice_number' => $kind === PaymentDocument::RECEIPT
                ? PaymentDocument::formatNumber($settings->invoice_series, $settings->invoice_number_start, $settings->number_padding)
                : null,
        ]);

        return $this->present($snapshot, $settings, 'original', ['tr' => 'ÖRNEK', 'en' => 'Sample']);
    }

    public function preview(PaymentDocumentSetting $settings, string $kind)
    {
        return $this->pdf($this->previewData($settings, $kind))->stream('preview-'.$kind.'.pdf');
    }

    /**
     * The next number a new document of this kind would take, or null when
     * the configured range is used up.
     */
    public function nextNumber(PaymentDocumentSetting $settings, string $kind): ?string
    {
        $series = $this->seriesFor($settings, $kind);
        $sequence = $this->nextSequence($settings, $kind, $series);
        $end = $this->rangeEndFor($settings, $kind);

        if ($end !== null && $sequence > $end) {
            return null;
        }

        return PaymentDocument::formatNumber($series, $sequence, $settings->number_padding);
    }

    /**
     * How many numbers are left in the range, or null when it is open ended.
     */
    public function remaining(PaymentDocumentSetting $settings, string $kind): ?int
    {
        $end = $this->rangeEndFor($settings, $kind);
        if ($end === null) {
            return null;
        }

        $series = $this->seriesFor($settings, $kind);

        return max(0, $end - $this->nextSequence($settings, $kind, $series) + 1);
    }

    /**
     * Returns the issued document, issuing it on first call.
     */
    public function issue(Payment $payment, string $kind): PaymentDocument
    {
        $existing = $this->issued($payment, $kind);
        if ($existing) {
            return $existing;
        }

        if ($kind === PaymentDocument::INVOICE
            && in_array(DealPaymentService::uiStateOf($payment), ['invalidated', 'failed'], true)) {
            throw new HttpException(409, 'This payment request ended before an invoice was issued.');
        }

        // A receipt is always "karşılığı" an invoice, so the invoice is issued
        // first and its number printed on the receipt.
        $invoiceNumber = null;
        $invoiceSnapshot = null;
        if ($kind === PaymentDocument::RECEIPT) {
            $invoice = $this->issued($payment, PaymentDocument::INVOICE) ?? $this->issue($payment, PaymentDocument::INVOICE);
            $invoiceSnapshot = $invoice->snapshot;
            $invoiceNumber = $invoiceSnapshot['number'] ?? null;
        }

        $companyId = (int) $payment->company_id;
        $paymentData = $this->paymentData($payment, $kind, $invoiceNumber);
        if ($invoiceSnapshot) {
            // The receipt settles that invoice, so it repeats the invoice's
            // amounts and KDV even if the KDV rate setting changed since.
            $paymentData['invoice_totals'] = [
                'subtotal' => $invoiceSnapshot['subtotal'] ?? null,
                'vat_rate' => $invoiceSnapshot['vat_rate'] ?? null,
                'vat' => $invoiceSnapshot['vat'] ?? null,
                'total' => $invoiceSnapshot['total'] ?? null,
            ];
        }
        // Look the TL rate up before taking the settings lock, so a slow rate
        // API never holds up other documents being issued for the company.
        $paymentData['try_rate'] = $this->tryRate(PaymentDocumentSetting::forCompany($companyId), $paymentData['currency_code']);

        $this->ensureSettingsRow($companyId);

        try {
            return DB::transaction(function () use ($payment, $kind, $companyId, $paymentData) {
                // Locking the settings row serialises issuing per company, so
                // two downloads at once can never take the same number.
                $settings = $this->lockedSettings($companyId);

                // An issued document is frozen, so it can never be issued
                // without the seller details the law requires on it.
                if (! $settings->hasSellerDetails()) {
                    throw new HttpException(409, 'Add the legal name, address, tax office and tax number in Invoices and receipts settings before issuing invoices or receipts.');
                }

                $series = $this->seriesFor($settings, $kind);
                $sequence = $this->nextSequence($settings, $kind, $series);
                $end = $this->rangeEndFor($settings, $kind);
                if ($end !== null && $sequence > $end) {
                    throw new HttpException(409, $kind === PaymentDocument::INVOICE
                        ? 'The invoice number range is used up. Add a new range in Invoices and receipts settings.'
                        : 'The receipt number range is used up. Add a new range in Invoices and receipts settings.');
                }

                $issuedAt = now();

                $snapshot = $this->snapshot($settings, $kind, array_merge($paymentData, [
                    'number' => PaymentDocument::formatNumber($series, $sequence, $settings->number_padding),
                    'issued_at' => $issuedAt,
                ]));

                return PaymentDocument::create([
                    'company_id' => $companyId,
                    'payment_id' => $payment->id,
                    'kind' => $kind,
                    'series' => $series,
                    'sequence' => $sequence,
                    'issued_at' => $issuedAt,
                    'snapshot' => $snapshot,
                    'issued_by' => user()?->id,
                ]);
            });
        } catch (QueryException $e) {
            // Another request issued this document between our check and the
            // insert: the unique index refused the duplicate, so use theirs.
            $raced = $this->issued($payment, $kind);
            if ($raced) {
                return $raced;
            }

            throw $e;
        }
    }

    private function issued(Payment $payment, string $kind): ?PaymentDocument
    {
        return PaymentDocument::query()
            ->where('payment_id', $payment->id)
            ->where('kind', $kind)
            ->first();
    }

    private function lockedSettings(int $companyId): PaymentDocumentSetting
    {
        return PaymentDocumentSetting::query()->where('company_id', $companyId)->lockForUpdate()->firstOrFail();
    }

    /**
     * Saves the company's default settings row if it has none yet, outside
     * the issuing transaction, so there is always a row to lock. When two
     * requests create it at once the unique index refuses one; that one
     * simply uses the row the other saved.
     */
    private function ensureSettingsRow(int $companyId): void
    {
        if (PaymentDocumentSetting::query()->where('company_id', $companyId)->exists()) {
            return;
        }

        try {
            PaymentDocumentSetting::forCompany($companyId)->save();
        } catch (QueryException $e) {
            if (! PaymentDocumentSetting::query()->where('company_id', $companyId)->exists()) {
                throw $e;
            }
        }
    }

    private function seriesFor(PaymentDocumentSetting $settings, string $kind): string
    {
        return (string) ($kind === PaymentDocument::INVOICE ? $settings->invoice_series : $settings->receipt_series);
    }

    private function rangeEndFor(PaymentDocumentSetting $settings, string $kind): ?int
    {
        $end = $kind === PaymentDocument::INVOICE ? $settings->invoice_number_end : $settings->receipt_number_end;

        return $end !== null ? (int) $end : null;
    }

    /**
     * The next number in a series: never below the range start, and always
     * after the last one issued, so numbers are never skipped or repeated.
     */
    private function nextSequence(PaymentDocumentSetting $settings, string $kind, string $series): int
    {
        $start = (int) ($kind === PaymentDocument::INVOICE ? $settings->invoice_number_start : $settings->receipt_number_start);

        $last = (int) PaymentDocument::query()
            ->where('company_id', $settings->company_id)
            ->where('kind', $kind)
            ->where('series', $series)
            ->max('sequence');

        return max(max(1, $start), $last + 1);
    }

    /**
     * Everything the document prints that comes from the payment and deal.
     *
     * @return array<string, mixed>
     */
    private function paymentData(Payment $payment, string $kind, ?string $invoiceNumber): array
    {
        $deal = $payment->relationLoaded('deal')
            ? $payment->deal
            : ($payment->deal_id
                ? Deal::withoutGlobalScope(CompanyScope::class)->find($payment->deal_id)
                : null);

        $currency = $payment->relationLoaded('currency') && $payment->currency
            ? $payment->currency
            : ($payment->currency_id
                ? Currency::withoutGlobalScope(CompanyScope::class)->find($payment->currency_id)
                : null);

        $collectedAt = $payment->paid_on ?? $payment->verified_at;

        return [
            'buyer' => $this->buyer($deal),
            'deal_name' => $deal?->name,
            'reference' => $payment->external_reference,
            'amount' => round((float) $payment->amount, 2),
            'currency_code' => $currency?->currency_code,
            'currency_symbol' => $currency?->currency_symbol,
            'method' => $this->methodOf($payment),
            'transaction_reference' => $payment->transaction_id ?: null,
            'received_by' => $this->userName($payment->verified_by_user_id),
            'invoice_number' => $invoiceNumber,
            'collected_at' => $collectedAt instanceof CarbonInterface ? Carbon::instance($collectedAt) : null,
        ];
    }

    /**
     * The full record of what the document prints, stored at issue.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function snapshot(PaymentDocumentSetting $settings, string $kind, array $data): array
    {
        /** @var CarbonInterface $issuedAt */
        $issuedAt = $data['issued_at'];
        // A receipt is dated the day the money was collected; the moment it
        // was issued is kept on the document row (issued_at).
        $documentDate = $kind === PaymentDocument::RECEIPT && ($data['collected_at'] ?? null) instanceof CarbonInterface
            ? $data['collected_at']
            : $issuedAt;
        $amount = (float) $data['amount'];
        $invoiceTotals = $data['invoice_totals'] ?? null;
        if ($invoiceTotals && $invoiceTotals['total'] !== null && $invoiceTotals['vat_rate'] !== null) {
            $amount = (float) $invoiceTotals['total'];
            $vatRate = (float) $invoiceTotals['vat_rate'];
            $net = (float) $invoiceTotals['subtotal'];
            $vat = (float) $invoiceTotals['vat'];
        } else {
            $vatRate = (float) $settings->vat_rate;
            // Request amounts are what the client pays, so KDV is included in them.
            $net = round($amount / (1 + $vatRate / 100), 2);
            $vat = round($amount - $net, 2);
        }
        $code = $data['currency_code'] ? strtoupper((string) $data['currency_code']) : null;

        $tryQuote = array_key_exists('try_rate', $data)
            ? ($settings->show_try_equivalent ? $data['try_rate'] : null)
            : $this->tryRate($settings, $code);
        // Round the rate first, so the printed rate reproduces the printed TL amount.
        $tryRate = $tryQuote ? round((float) $tryQuote['rate'], 4) : null;

        $seriesEnd = $this->rangeEndFor($settings, $kind);
        $seriesStart = (int) ($kind === PaymentDocument::INVOICE ? $settings->invoice_number_start : $settings->receipt_number_start);
        $series = $this->seriesFor($settings, $kind);

        return [
            'kind' => $kind,
            'number' => $data['number'],
            'issued_on' => $documentDate->format('d.m.Y'),
            'due_on' => $kind === PaymentDocument::INVOICE && $settings->payment_term_days > 0
                ? $issuedAt->copy()->addDays($settings->payment_term_days)->format('d.m.Y')
                : null,
            'seller' => [
                'legal_name' => $settings->legal_name,
                'address' => $settings->address,
                'phone' => $settings->phone,
                'email' => $settings->email,
                'tax_office' => $settings->tax_office,
                'tax_number' => $settings->tax_number,
                'registration_number' => $settings->registration_number,
            ],
            'approval' => [
                'number' => $settings->approval_number,
                'range' => $seriesEnd !== null
                    ? PaymentDocument::formatNumber($series, $seriesStart, $settings->number_padding)
                        .' – '.PaymentDocument::formatNumber($series, $seriesEnd, $settings->number_padding)
                    : null,
                'show_stamp_duty' => (bool) $settings->show_stamp_duty,
                'show_seal' => (bool) $settings->show_approval_seal,
            ],
            'bank' => [
                'name' => $settings->bank_name,
                'account_name' => $settings->bank_account_name,
                'iban' => $settings->iban,
                'swift' => $settings->swift,
            ],
            'footer_note' => $settings->footer_note,
            'buyer' => $data['buyer'],
            'deal_name' => $data['deal_name'],
            'reference' => $data['reference'],
            'invoice_number' => $data['invoice_number'] ?? null,
            'lines' => [[
                'description' => 'Hizmet bedeli',
                'detail' => trim(($data['deal_name'] ?: '').($data['reference'] ? ' · Ödeme talebi '.$data['reference'] : ''), ' ·'),
                'quantity' => 1,
                'unit_price' => $net,
                'total' => $net,
            ]],
            'currency_code' => $code,
            'currency_symbol' => $data['currency_symbol'],
            'subtotal' => $net,
            'vat_rate' => $vatRate,
            'vat' => $vat,
            'total' => $amount,
            'amount_in_words' => TurkishAmountInWords::format($amount, $code),
            'try' => $tryRate ? [
                'rate' => $tryRate,
                'amount' => round($amount * $tryRate, 2),
                'date' => $tryQuote['date'] ? Carbon::parse($tryQuote['date'])->format('d.m.Y') : null,
            ] : null,
            'method' => $data['method'],
            'transaction_reference' => $data['transaction_reference'],
            'received_by' => $data['received_by'],
        ];
    }

    /**
     * @return array{rate: float, date: string|null}|null
     */
    private function tryRate(PaymentDocumentSetting $settings, ?string $currencyCode): ?array
    {
        $code = $currencyCode ? strtoupper($currencyCode) : null;
        if (! $settings->show_try_equivalent || ! $code || in_array($code, ['TRY', 'TL'], true)) {
            return null;
        }

        return $this->exchangeRates->quote($code, 'TRY');
    }

    /**
     * Turns a snapshot into the PDF view's data, adding the branding that
     * follows the current settings.
     *
     * @param  array<string, mixed>  $snapshot
     * @param  array{tr: string, en: string}|null  $stamp
     * @return array<string, mixed>
     */
    private function present(array $snapshot, PaymentDocumentSetting $settings, string $copy, ?array $stamp): array
    {
        $code = $snapshot['currency_code'] ?? null;
        $symbol = $snapshot['currency_symbol'] ?? null;
        $money = fn (?float $value) => $value === null ? null : $this->money($value);
        $buyerName = $snapshot['buyer']['name'] ?? null;

        return array_merge($snapshot, [
            'title' => $snapshot['kind'] === PaymentDocument::INVOICE ? 'FATURA' : 'TAHSİLAT MAKBUZU',
            'title_en' => $snapshot['kind'] === PaymentDocument::INVOICE ? 'Invoice' : 'Payment receipt',
            'filename' => $snapshot['kind'].'-'.str_replace(' ', '', (string) $snapshot['number']).'.pdf',
            'logo_data_uri' => $this->logoDataUri($settings),
            'brand_color' => $this->safeColor($settings->brand_color),
            'bilingual' => (bool) $settings->bilingual_labels,
            // Only a copy is marked; the original carries no label.
            'copy_label' => $copy === 'copy' ? ['tr' => 'SURET', 'en' => 'Copy'] : null,
            'stamp' => $stamp,
            'currency_label' => $code ?: '',
            'currency_prefix' => $symbol && $symbol !== $code ? $symbol.' ' : '',
            'subtotal_display' => $money($snapshot['subtotal'] ?? null),
            'vat_display' => $money($snapshot['vat'] ?? null),
            'vat_rate_display' => $this->percent((float) ($snapshot['vat_rate'] ?? 0)),
            'total_display' => $money($snapshot['total'] ?? null),
            'lines_display' => array_map(fn (array $line) => array_merge($line, [
                'unit_price_display' => $this->money((float) $line['unit_price']),
                'total_display' => $this->money((float) $line['total']),
            ]), $snapshot['lines'] ?? []),
            'try_display' => isset($snapshot['try']) && $snapshot['try'] ? [
                'amount' => $this->money((float) $snapshot['try']['amount']),
                'rate' => number_format((float) $snapshot['try']['rate'], 4, ',', '.'),
                'date' => $snapshot['try']['date'],
            ] : null,
            'payer_ablative' => $buyerName ? TurkishSuffix::ablative($buyerName) : null,
        ]);
    }

    /**
     * @return array{tr: string, en: string}|null
     */
    private function stampFor(string $uiState): ?array
    {
        return match ($uiState) {
            'invalidated' => ['tr' => 'İPTAL', 'en' => 'Cancelled'],
            'failed' => ['tr' => 'ÖDENMEDİ', 'en' => 'Unpaid'],
            default => null,
        };
    }

    private function methodOf(Payment $payment): string
    {
        $type = strtolower((string) ($payment->ol_payment_type ?? ''));
        $gateway = strtolower((string) ($payment->gateway ?? ''));

        return match (true) {
            $type === 'crypto' || $gateway === 'nowpayments' => 'crypto',
            in_array($type, ['card', 'stripe'], true) || str_contains($gateway, 'stripe') => 'card',
            $type === 'cash' => 'cash',
            default => 'transfer',
        };
    }

    /**
     * @return array{name: ?string, lines: array<int, string>, tax_id: ?string}
     */
    private function buyer(?Deal $deal): array
    {
        $empty = ['name' => null, 'lines' => [], 'tax_id' => null];
        $leadId = $deal?->lead_id ?? null;
        if (! $leadId || ! Schema::hasTable('leads')) {
            return $empty;
        }

        $columns = ['id'];
        foreach (['client_name', 'company_name', 'address', 'city', 'state', 'postal_code', 'country'] as $column) {
            if (Schema::hasColumn('leads', $column)) {
                $columns[] = $column;
            }
        }

        $lead = DB::table('leads')->where('id', $leadId)->first($columns);
        if ($lead === null) {
            return $empty;
        }

        $cityLine = trim(implode(' ', array_filter([$lead->postal_code ?? null, $lead->city ?? null])));

        return [
            'name' => ($lead->client_name ?? null) ?: ($lead->company_name ?? null),
            'lines' => array_values(array_filter([
                ($lead->client_name ?? null) && ($lead->company_name ?? null) ? $lead->company_name : null,
                $lead->address ?? null,
                $cityLine ?: null,
                $lead->country ?? null,
            ])),
            'tax_id' => null,
        ];
    }

    private function userName(mixed $userId): ?string
    {
        if (! $userId || ! Schema::hasTable('users')) {
            return null;
        }

        return DB::table('users')->where('id', $userId)->value('name');
    }

    private function logoDataUri(PaymentDocumentSetting $settings): ?string
    {
        if (! $settings->logo) {
            return null;
        }

        try {
            $path = PaymentDocumentSetting::LOGO_PATH.'/'.$settings->logo;
            $disk = Storage::disk(config('filesystems.default'));
            if (! $disk->exists($path)) {
                return null;
            }
            $contents = $disk->get($path);
            $mime = match (strtolower(pathinfo($settings->logo, PATHINFO_EXTENSION))) {
                'jpg', 'jpeg' => 'image/jpeg',
                'gif' => 'image/gif',
                'webp' => 'image/webp',
                default => 'image/png',
            };

            return 'data:'.$mime.';base64,'.base64_encode((string) $contents);
        } catch (\Throwable) {
            return null;
        }
    }

    private function safeColor(?string $color): string
    {
        return is_string($color) && preg_match('/^#[0-9a-fA-F]{6}$/', $color) ? $color : PaymentDocumentSetting::DEFAULTS['brand_color'];
    }

    private function pdf(array $data)
    {
        $pdf = app('dompdf.wrapper');
        // Embed only the glyphs used, or every PDF carries the full DejaVu fonts (~1 MB).
        $pdf->setOption('isFontSubsettingEnabled', true);
        $pdf->setPaper($data['kind'] === PaymentDocument::RECEIPT ? 'a5' : 'a4', $data['kind'] === PaymentDocument::RECEIPT ? 'landscape' : 'portrait');
        $pdf->loadView('payment-requests.document', $data);

        return $pdf;
    }

    private function filename(string $kind, Payment $payment): string
    {
        $document = $this->issued($payment, $kind);

        return $kind.'-'.str_replace(' ', '', (string) ($document?->snapshot['number'] ?? $payment->id)).'.pdf';
    }

    private function assertKind(string $kind): void
    {
        if (! in_array($kind, self::KINDS, true)) {
            throw new HttpException(422, 'Unknown document.');
        }
    }

    /** Turkish money format: 4.350,00 */
    private function money(float $amount): string
    {
        return number_format($amount, 2, ',', '.');
    }

    private function percent(float $rate): string
    {
        return rtrim(rtrim(number_format($rate, 2, ',', ''), '0'), ',');
    }
}
