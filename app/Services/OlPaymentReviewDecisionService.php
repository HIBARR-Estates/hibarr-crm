<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\User;
use App\Support\FeatureFlags;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OlPaymentReviewDecisionService
{
    private const STATUS_TO_DECISION = [
        'complete' => 'approved',
        'failed' => 'rejected',
    ];

    /**
     * After a local status change, notify OL for eligible payments.
     * Failures are logged and never thrown — CRM state must already be persisted.
     *
     * @param  array<int|string>  $paymentIds
     */
    public function notifyEligibleAfterStatusChange(array $paymentIds, string $crmStatus, ?User $admin = null): void
    {
        if (!FeatureFlags::enabled('packages.online-payment')) {
            return;
        }

        if (!isset(self::STATUS_TO_DECISION[$crmStatus])) {
            return;
        }

        $ids = collect($paymentIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->values()
            ->all();

        if ($ids === []) {
            return;
        }

        Payment::query()
            ->without(['order', 'currency'])
            ->whereIn('id', $ids)
            ->whereNotNull('external_reference')
            ->where('external_reference', '!=', '')
            ->get()
            ->each(fn (Payment $payment) => $this->notify($payment, $crmStatus, $admin));
    }

    public function notify(Payment $payment, string $crmStatus, ?User $admin = null): void
    {
        $decision = self::STATUS_TO_DECISION[$crmStatus] ?? null;
        if ($decision === null) {
            return;
        }

        $externalReference = trim((string) ($payment->external_reference ?? ''));
        if ($externalReference === '') {
            return;
        }

        $payload = [
            'external_reference' => $externalReference,
            'decision' => $decision,
            'decided_by' => [
                'id' => $admin?->id,
                'email' => $admin?->email,
                'name' => $admin?->name,
            ],
            'decided_at' => now()->toIso8601String(),
        ];

        $response = $this->olRequest($payload, $payment, $decision, $admin);
        if ($response === null) {
            return;
        }

        if (!$response->successful()) {
            Log::error('OlPaymentReviewDecisionService: OL returned non-2xx', [
                'payment_id' => $payment->id,
                'external_reference' => $externalReference,
                'decision' => $decision,
                'admin_id' => $admin?->id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function olRequest(array $payload, Payment $payment, string $decision, ?User $admin): ?Response
    {
        $baseUrl = (string) config('services.ol.base_url', '');
        $apiKey = (string) config('services.ol.api_key', '');
        $timeout = (int) config('services.ol.timeout', 15);
        $path = (string) config(
            'services.ol.payment_review_decision_path',
            '/internal/payments/review-decision'
        );

        if ($baseUrl === '' || $apiKey === '') {
            Log::error('OlPaymentReviewDecisionService: OL config missing', [
                'payment_id' => $payment->id,
                'external_reference' => $payment->external_reference,
                'decision' => $decision,
                'admin_id' => $admin?->id,
                'base_url_set' => $baseUrl !== '',
                'api_key_set' => $apiKey !== '',
            ]);

            return null;
        }

        if ($path === '') {
            Log::error('OlPaymentReviewDecisionService: review-decision path missing', [
                'payment_id' => $payment->id,
                'external_reference' => $payment->external_reference,
                'decision' => $decision,
                'admin_id' => $admin?->id,
            ]);

            return null;
        }

        $url = rtrim($baseUrl, '/') . '/' . ltrim($path, '/');

        try {
            return Http::timeout($timeout)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'X-Api-Key' => $apiKey,
                    'Accept' => 'application/json',
                ])
                ->post($url, $payload);
        } catch (\Throwable $e) {
            Log::error('OlPaymentReviewDecisionService: OL request failed', [
                'payment_id' => $payment->id,
                'external_reference' => $payment->external_reference,
                'decision' => $decision,
                'admin_id' => $admin?->id,
                'url' => $url,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
