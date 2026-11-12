<?php

namespace App\Services;

use App\Models\Currency;
use App\Models\Deal;
use App\Models\Payment;
use App\Scopes\CompanyScope;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Branded invoice and receipt PDFs for a deal payment request.
 * An invoice exists for every request. A receipt exists only once the
 * payment has been collected (confirmed transfer or paid online).
 */
class DealPaymentDocumentService
{
    /**
     * @return array<string, mixed>
     */
    public function viewData(Payment $payment, string $kind): array
    {
        if (!in_array($kind, ['invoice', 'receipt'], true)) {
            throw new HttpException(422, 'Unknown document.');
        }

        $uiState = DealPaymentService::uiStateOf($payment);
        if ($kind === 'receipt' && !in_array($uiState, ['confirmed', 'paid_online'], true)) {
            throw new HttpException(409, 'A receipt is available once the payment has been collected.');
        }

        $deal = $payment->relationLoaded('deal')
            ? $payment->deal
            : ($payment->deal_id
                ? Deal::withoutGlobalScope(CompanyScope::class)->find($payment->deal_id)
                : null);

        $company = $this->companyRow($payment->company_id);
        $lead = $this->leadRow($deal);
        $currency = $this->currency($payment->currency_id, $payment);
        $baseCurrency = $payment->default_currency_id
            ? Currency::withoutGlobalScope(CompanyScope::class)->find($payment->default_currency_id)
            : null;

        $number = ($kind === 'receipt' ? 'RCT-' : 'INV-') . str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT);
        $documentDate = $kind === 'receipt'
            ? ($payment->paid_on ?? $payment->verified_at ?? $payment->created_at)
            : $payment->created_at;

        $amount = round((float) $payment->amount, 2);
        $baseAmount = $payment->base_amount !== null ? round((float) $payment->base_amount, 2) : null;
        $currencyCode = $currency?->currency_code;
        $baseCode = $baseCurrency?->currency_code;
        $showBase = $baseAmount !== null && $baseCode && $baseCode !== $currencyCode;

        return [
            'kind' => $kind,
            'title' => $kind === 'receipt'
                ? __('pages.payment_requests.document.receipt')
                : __('pages.payment_requests.document.invoice'),
            'number' => $number,
            'filename' => strtolower($kind) . '-' . $number . '.pdf',
            'issued_on' => $this->formatDate($documentDate),
            'company_name' => $company['name'] ?: config('app.name'),
            'company_lines' => array_values(array_filter([
                $company['address'],
                $company['email'],
                $company['phone'],
                $company['tax'],
            ])),
            'party_label' => $kind === 'receipt'
                ? __('pages.payment_requests.document.paid_by')
                : __('pages.payment_requests.document.bill_to'),
            'party_lines' => array_values(array_filter([
                $lead['name'],
                $lead['company'],
                $lead['email'],
            ])),
            'deal_name' => $deal?->name ?: __('pages.payment_requests.document.deal_fallback'),
            'description' => __('pages.payment_requests.document.line', [
                'deal' => $deal?->name ?: __('pages.payment_requests.document.deal_fallback'),
            ]),
            'amount' => $this->money($amount, $currencyCode, $currency?->currency_symbol),
            'base_amount' => $showBase ? $this->money($baseAmount, $baseCode, $baseCurrency?->currency_symbol) : null,
            'rate' => ($showBase && $payment->exchange_rate)
                ? '1 ' . $baseCode . ' = ' . rtrim(rtrim(number_format(1 / (float) $payment->exchange_rate, 6, '.', ''), '0'), '.') . ' ' . $currencyCode
                : null,
            'method' => match ($payment->gateway) {
                'manual-bank-transfer' => __('pages.payment_requests.method_bank_transfer'),
                'nowpayments' => __('pages.payment_requests.method_crypto'),
                default => __('pages.payment_requests.method_client_choice'),
            },
            'status' => __('pages.payment_requests.document.states.' . $uiState),
            'stamp' => match ($uiState) {
                'invalidated' => __('pages.payment_requests.document.cancelled_stamp'),
                'failed' => __('pages.payment_requests.document.failed_stamp'),
                default => null,
            },
            'reference' => $payment->external_reference,
            'ui_state' => $uiState,
        ];
    }

    public function download(Payment $payment, string $kind)
    {
        $data = $this->viewData($payment, $kind);

        $pdf = app('dompdf.wrapper');
        $pdf->setPaper('a4');
        $pdf->loadView('payment-requests.document', $data);

        return $pdf->download($data['filename']);
    }

    /**
     * @return array{name: ?string, address: ?string, email: ?string, phone: ?string, tax: ?string}
     */
    private function companyRow(?int $companyId): array
    {
        $empty = ['name' => null, 'address' => null, 'email' => null, 'phone' => null, 'tax' => null];
        if (!$companyId || !Schema::hasTable('companies')) {
            return $empty;
        }

        $columns = ['id', 'company_name'];
        foreach (['address', 'company_email', 'company_phone'] as $column) {
            if (Schema::hasColumn('companies', $column)) {
                $columns[] = $column;
            }
        }

        $row = DB::table('companies')->where('id', $companyId)->first($columns);
        if ($row === null) {
            return $empty;
        }

        $address = property_exists($row, 'address') ? $row->address : null;
        $tax = null;
        if (Schema::hasTable('company_addresses')) {
            $office = DB::table('company_addresses')
                ->where('company_id', $companyId)
                ->orderByDesc('is_default')
                ->first();
            if ($office) {
                $address = $office->address ?: $address;
                if (!empty($office->tax_number)) {
                    $tax = trim(($office->tax_name ? $office->tax_name . ' ' : '') . $office->tax_number);
                }
            }
        }

        return [
            'name' => $row->company_name ?? null,
            'address' => $address,
            'email' => property_exists($row, 'company_email') ? $row->company_email : null,
            'phone' => property_exists($row, 'company_phone') ? $row->company_phone : null,
            'tax' => $tax,
        ];
    }

    /**
     * @return array{name: ?string, company: ?string, email: ?string}
     */
    private function leadRow(?Deal $deal): array
    {
        $empty = ['name' => null, 'company' => null, 'email' => null];
        if ($deal === null || !Schema::hasColumn('deals', 'lead_id') || !Schema::hasTable('leads')) {
            return $empty;
        }

        $leadId = $deal->lead_id ?? null;
        if (!$leadId) {
            return $empty;
        }

        $columns = ['id'];
        foreach (['client_name', 'company_name', 'client_email'] as $column) {
            if (Schema::hasColumn('leads', $column)) {
                $columns[] = $column;
            }
        }

        $lead = DB::table('leads')->where('id', $leadId)->first($columns);
        if ($lead === null) {
            return $empty;
        }

        return [
            'name' => property_exists($lead, 'client_name') ? $lead->client_name : null,
            'company' => property_exists($lead, 'company_name') ? $lead->company_name : null,
            'email' => property_exists($lead, 'client_email') ? $lead->client_email : null,
        ];
    }

    private function currency(?int $currencyId, Payment $payment): ?Currency
    {
        if ($payment->relationLoaded('currency') && $payment->currency) {
            return $payment->currency;
        }

        return $currencyId
            ? Currency::withoutGlobalScope(CompanyScope::class)->find($currencyId)
            : null;
    }

    private function money(float $amount, ?string $code, ?string $symbol): string
    {
        $formatted = number_format($amount, 2, '.', ',');
        if ($symbol && $symbol !== $code) {
            return trim($symbol . $formatted . ($code ? ' ' . $code : ''));
        }

        return trim($formatted . ($code ? ' ' . $code : ''));
    }

    private function formatDate(mixed $value): ?string
    {
        if (!$value instanceof CarbonInterface) {
            return null;
        }

        return $value->timezone(config('app.timezone'))->format('d M Y');
    }
}
