<?php

namespace App\Http\Controllers;

use App\Helper\Files;
use App\Models\PaymentDocument;
use App\Models\PaymentDocumentSetting;
use App\Services\DealPaymentDocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Invoices and receipts settings: everything printed on the KKTC Fatura and
 * Tahsilat Makbuzu issued for deal payment requests. Seller details, logo
 * and brand colour, number ranges, KDV rate, tax office approval and bank
 * details.
 *
 * Changes apply to documents issued from now on. Documents already issued
 * keep the details they were printed with.
 */
class PaymentDocumentSettingsController extends AccountBaseController
{
    public function __construct(
        private readonly DealPaymentDocumentService $documents,
    ) {
        parent::__construct();
        $this->pageTitle = 'pages.payment_document_settings.title';
        $this->activeSettingMenu = 'payment_document_settings';

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_company_setting') !== 'all');

            return $next($request);
        });
    }

    public function index()
    {
        $settings = PaymentDocumentSetting::forCompany(company()->id);

        return Inertia::render('Settings/PaymentDocuments/Index', [
            'pageTitle' => __('pages.payment_document_settings.title'),
            'settings' => $this->payload($settings),
            // Only the counters wait on a query, so they never hold up the form.
            'numbering' => Inertia::defer(fn () => $this->numbering($settings)),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $settings = PaymentDocumentSetting::forCompany(company()->id);
        $settings->fill($validated);
        $settings->updated_by = user()->id;
        $settings->save();

        return response()->json([
            'status' => 'success',
            'message' => __('messages.updateSuccess'),
            'data' => [
                'settings' => $this->payload($settings),
                'numbering' => $this->numbering($settings),
            ],
        ]);
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate([
            // dompdf renders PNG and JPEG reliably; SVG and WebP are not safe in the PDF.
            'logo' => 'required|file|mimes:png,jpg,jpeg|max:2048',
        ]);

        $settings = PaymentDocumentSetting::forCompany(company()->id);
        $previous = $settings->logo;

        $settings->logo = Files::uploadLocalOrS3($request->file('logo'), PaymentDocumentSetting::LOGO_PATH);
        $settings->updated_by = user()->id;
        $settings->save();

        if ($previous) {
            Files::deleteFile($previous, PaymentDocumentSetting::LOGO_PATH);
        }

        return response()->json([
            'status' => 'success',
            'message' => __('messages.updateSuccess'),
            'data' => ['settings' => $this->payload($settings)],
        ]);
    }

    public function removeLogo(): JsonResponse
    {
        $settings = PaymentDocumentSetting::forCompany(company()->id);

        if ($settings->logo) {
            Files::deleteFile($settings->logo, PaymentDocumentSetting::LOGO_PATH);
            $settings->logo = null;
            $settings->updated_by = user()->id;
            $settings->save();
        }

        return response()->json([
            'status' => 'success',
            'message' => __('messages.deleteSuccess'),
            'data' => ['settings' => $this->payload($settings)],
        ]);
    }

    /**
     * A sample PDF from the saved settings. Takes no number from the range.
     */
    public function preview(string $kind)
    {
        return $this->documents->preview(PaymentDocumentSetting::forCompany(company()->id), $kind);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(): array
    {
        $series = ['required', 'string', 'max:10', 'regex:/^[A-Za-z0-9\-\/]+$/'];

        return [
            'legal_name' => 'required|string|max:255',
            'address' => 'required|string|max:1000',
            'phone' => 'nullable|string|max:64',
            'email' => 'nullable|email|max:255',
            'tax_office' => 'required|string|max:120',
            'tax_number' => 'required|string|max:64',
            'registration_number' => 'nullable|string|max:64',

            'brand_color' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],

            'invoice_series' => $series,
            'invoice_number_start' => 'required|integer|min:1|max:999999999',
            'invoice_number_end' => 'nullable|integer|gte:invoice_number_start|max:999999999',
            'receipt_series' => $series,
            'receipt_number_start' => 'required|integer|min:1|max:999999999',
            'receipt_number_end' => 'nullable|integer|gte:receipt_number_start|max:999999999',
            'number_padding' => 'required|integer|min:1|max:10',

            'vat_rate' => 'required|numeric|min:0|max:100',
            'approval_number' => 'nullable|string|max:64',
            'show_stamp_duty' => 'required|boolean',
            'show_approval_seal' => 'required|boolean',

            'bank_name' => 'nullable|string|max:255',
            'bank_account_name' => 'nullable|string|max:255',
            'iban' => 'nullable|string|max:64',
            'swift' => 'nullable|string|max:32',
            'payment_term_days' => 'required|integer|min:0|max:365',
            'show_try_equivalent' => 'required|boolean',

            'bilingual_labels' => 'required|boolean',
            'footer_note' => 'nullable|string|max:1000',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(PaymentDocumentSetting $settings): array
    {
        return [
            'saved' => $settings->exists,
            'legal_name' => $settings->legal_name,
            'address' => $settings->address,
            'phone' => $settings->phone,
            'email' => $settings->email,
            'tax_office' => $settings->tax_office,
            'tax_number' => $settings->tax_number,
            'registration_number' => $settings->registration_number,
            'logo_url' => $settings->logo_url,
            'brand_color' => $settings->brand_color,
            'invoice_series' => $settings->invoice_series,
            'invoice_number_start' => $settings->invoice_number_start,
            'invoice_number_end' => $settings->invoice_number_end,
            'receipt_series' => $settings->receipt_series,
            'receipt_number_start' => $settings->receipt_number_start,
            'receipt_number_end' => $settings->receipt_number_end,
            'number_padding' => $settings->number_padding,
            'vat_rate' => (float) $settings->vat_rate,
            'approval_number' => $settings->approval_number,
            'show_stamp_duty' => (bool) $settings->show_stamp_duty,
            'show_approval_seal' => (bool) $settings->show_approval_seal,
            'bank_name' => $settings->bank_name,
            'bank_account_name' => $settings->bank_account_name,
            'iban' => $settings->iban,
            'swift' => $settings->swift,
            'payment_term_days' => $settings->payment_term_days,
            'show_try_equivalent' => (bool) $settings->show_try_equivalent,
            'bilingual_labels' => (bool) $settings->bilingual_labels,
            'footer_note' => $settings->footer_note,
        ];
    }

    /**
     * @return array<string, array{next: ?string, remaining: ?int, issued: int}>
     */
    private function numbering(PaymentDocumentSetting $settings): array
    {
        $out = [];
        foreach (DealPaymentDocumentService::KINDS as $kind) {
            $out[$kind] = [
                'next' => $this->documents->nextNumber($settings, $kind),
                'remaining' => $this->documents->remaining($settings, $kind),
                'issued' => PaymentDocument::query()
                    ->where('company_id', $settings->company_id)
                    ->where('kind', $kind)
                    ->count(),
            ];
        }

        return $out;
    }
}
