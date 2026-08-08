<?php

namespace App\Http\Requests\ApiV2\CrmWrite;

use App\Models\Currency;
use App\Scopes\CompanyScope;
use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Validator;

class UpsertPaymentV2Request extends CoreRequest
{
    private const STATUS_ALIASES = [
        'approved' => 'complete',
        'rejected' => 'failed',
        'proof_submitted' => 'pending',
        'proof-submitted' => 'pending',
    ];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $companyId = $this->header('X-COMPANY-ID');
        $companyId = $companyId && is_numeric($companyId) ? (int) $companyId : null;

        $status = strtolower(trim((string) $this->input('status', '')));
        if ($status !== '' && isset(self::STATUS_ALIASES[$status])) {
            $status = self::STATUS_ALIASES[$status];
        }

        $currency = $this->input('currency');
        if (is_string($currency)) {
            $currency = strtoupper(trim($currency));
        }

        $this->merge([
            'companyId' => $companyId,
            'status' => $status !== '' ? $status : $this->input('status'),
            'currency' => $currency ?? $this->input('currency'),
        ]);
    }

    public function rules(): array
    {
        return [
            'deal_id' => 'required|integer',
            'external_reference' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0',
            'currency' => 'required|string|max:10',
            'currency_id' => 'nullable|integer',
            'status' => 'required|in:pending,complete,failed',
            'gateway' => 'required|string|max:255',
            'paid_on' => 'nullable|date',
            'transaction_id' => 'nullable|string|max:255',
            'proof_url' => 'nullable|url|max:2048',
            'bill' => 'nullable|file|mimes:jpg,jpeg,png,pdf,webp|max:10240',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $companyId = (int) $this->input('companyId');
            $currencyCode = (string) $this->input('currency');

            $currency = Currency::withoutGlobalScope(CompanyScope::class)
                ->where('company_id', $companyId)
                ->where('currency_code', $currencyCode)
                ->first();

            if ($currency === null) {
                $validator->errors()->add('currency', 'The selected currency is invalid for this company.');

                return;
            }

            $this->merge(['currency_id' => $currency->id]);
        });
    }
}
