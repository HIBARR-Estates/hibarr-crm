<?php

namespace App\Grpc\Transformers;

use App\Models\Currency;

/**
 * Transforms Currency Eloquent models to gRPC message arrays.
 */
class CurrencyTransformer
{
    /**
     * Transform a Currency model to a gRPC-compatible array.
     *
     * @param Currency $currency
     * @return array
     */
    public function transform(Currency $currency): array
    {
        return [
            'id' => (int) $currency->id,
            'currency_name' => (string) ($currency->currency_name ?? ''),
            'currency_symbol' => (string) ($currency->currency_symbol ?? ''),
            'currency_code' => (string) ($currency->currency_code ?? ''),
            'exchange_rate' => (float) ($currency->exchange_rate ?? 0),
            'is_cryptocurrency' => (string) ($currency->is_cryptocurrency ?? 'no'),
            'usd_price' => (float) ($currency->usd_price ?? 0),
            'currency_position' => (string) ($currency->currency_position ?? 'left'),
            'no_of_decimal' => (int) ($currency->no_of_decimal ?? 0),
            'thousand_separator' => (string) ($currency->thousand_separator ?? ''),
            'decimal_separator' => (string) ($currency->decimal_separator ?? ''),
            'company_id' => (int) ($currency->company_id ?? 0),
            'created_at' => $this->formatDateTime($currency->created_at),
            'updated_at' => $this->formatDateTime($currency->updated_at),
        ];
    }

    /**
     * Transform a collection of currencies.
     *
     * @param iterable $currencies
     * @return array
     */
    public function transformCollection(iterable $currencies): array
    {
        $result = [];
        foreach ($currencies as $currency) {
            $result[] = $this->transform($currency);
        }
        return $result;
    }

    /**
     * Format a datetime to ISO8601 string.
     *
     * @param mixed $datetime
     * @return string
     */
    protected function formatDateTime($datetime): string
    {
        if ($datetime === null) {
            return '';
        }

        if ($datetime instanceof \Carbon\Carbon || $datetime instanceof \DateTime) {
            return $datetime->toIso8601String();
        }

        return (string) $datetime;
    }
}
