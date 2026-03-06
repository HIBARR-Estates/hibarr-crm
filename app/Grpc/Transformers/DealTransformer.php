<?php

namespace App\Grpc\Transformers;

use App\Models\Deal;

/**
 * Transforms Deal Eloquent models to gRPC message arrays.
 * Uses flat structure with ID references only (no nested objects).
 */
class DealTransformer
{
    /**
     * Transform a Deal model to a gRPC-compatible array.
     *
     * @param Deal $deal
     * @return array
     */
    public function transform(Deal $deal): array
    {
        return [
            'id' => (int) $deal->id,
            'name' => (string) ($deal->name ?? ''),
            
            // Foreign key references (flat)
            'contact_id' => (int) ($deal->lead_id ?? 0),
            'agent_id' => (int) ($deal->agent_id ?? 0),
            'pipeline_id' => (int) ($deal->lead_pipeline_id ?? 0),
            'pipeline_stage_id' => (int) ($deal->pipeline_stage_id ?? 0),
            'source_id' => (int) ($deal->source_id ?? 0),
            'category_id' => (int) ($deal->category_id ?? 0),
            'currency_id' => (int) ($deal->currency_id ?? 0),
            'company_id' => (int) ($deal->company_id ?? 0),
            'client_id' => (int) ($deal->client_id ?? 0),
            'added_by' => (int) ($deal->added_by ?? 0),
            'last_updated_by' => (int) ($deal->last_updated_by ?? 0),
            
            // Value fields
            'total_value' => (float) ($deal->total_value ?? 0),
            'close_date' => $this->formatDate($deal->close_date),
            'next_follow_up_date' => $this->formatDate($deal->next_follow_up_date),
            'column_priority' => (int) ($deal->column_priority ?? 0),
            
            // External integration
            'bitrix_id' => (string) ($deal->bitrix_id ?? ''),
            
            // Metadata
            'created_at' => $this->formatDateTime($deal->created_at),
            'updated_at' => $this->formatDateTime($deal->updated_at),
            
            // Related IDs (many-to-many as arrays)
            'watcher_ids' => $this->extractIds($deal->dealWatchers ?? collect()),
            'participant_ids' => $this->extractIds($deal->dealParticipants ?? collect()),
            'package_ids' => $this->extractIds($deal->packages ?? collect()),
            'product_ids' => $this->extractIds($deal->products ?? collect()),
        ];
    }

    /**
     * Transform a collection of deals.
     *
     * @param iterable $deals
     * @return array
     */
    public function transformCollection(iterable $deals): array
    {
        $result = [];
        foreach ($deals as $deal) {
            $result[] = $this->transform($deal);
        }
        return $result;
    }

    /**
     * Format a date to ISO8601 string.
     *
     * @param mixed $date
     * @return string
     */
    protected function formatDate($date): string
    {
        if ($date === null) {
            return '';
        }
        
        if ($date instanceof \Carbon\Carbon || $date instanceof \DateTime) {
            return $date->format('Y-m-d');
        }
        
        return (string) $date;
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

    /**
     * Extract IDs from a collection of related models.
     *
     * @param iterable $collection
     * @return array
     */
    protected function extractIds(iterable $collection): array
    {
        $ids = [];
        foreach ($collection as $item) {
            if (isset($item->id)) {
                $ids[] = (int) $item->id;
            }
        }
        return $ids;
    }
}
