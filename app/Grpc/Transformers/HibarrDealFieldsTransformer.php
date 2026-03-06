<?php

namespace App\Grpc\Transformers;

use App\Models\HibarrDealFields;

/**
 * Transforms HibarrDealFields Eloquent models to gRPC message arrays.
 */
class HibarrDealFieldsTransformer
{
    /**
     * Transform a HibarrDealFields model to a gRPC-compatible array.
     *
     * @param HibarrDealFields $record
     * @return array
     */
    public function transform(HibarrDealFields $record): array
    {
        return [
            'id' => (int) $record->id,
            'deal_id' => (int) ($record->deal_id ?? 0),
            'interested_in' => (string) ($record->interested_in ?? ''),
            'motivation' => (string) ($record->motivation ?? ''),
            'purchase_timeline' => (string) ($record->purchase_timeline ?? ''),
            'budget_range' => (string) ($record->budget_range ?? ''),
            'message' => (string) ($record->message ?? ''),
            'strategy_meeting_booked' => (bool) $record->strategy_meeting_booked,
            'downpayment_paid' => (bool) $record->downpayment_paid,
            'inspection_trip_date' => $this->formatDateTime($record->inspection_trip_date),
            'deposit_confirmation' => (string) ($record->deposit_confirmation ?? ''),
            'reservation_agreement' => (string) ($record->reservation_agreement ?? ''),
            'sales_contract' => (string) ($record->sales_contract ?? ''),
            'created_at' => $this->formatDateTime($record->created_at),
            'updated_at' => $this->formatDateTime($record->updated_at),
        ];
    }

    /**
     * Transform a collection of records.
     *
     * @param iterable $records
     * @return array
     */
    public function transformCollection(iterable $records): array
    {
        $result = [];
        foreach ($records as $record) {
            $result[] = $this->transform($record);
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
