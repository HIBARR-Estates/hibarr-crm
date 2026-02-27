<?php

namespace App\Grpc\Transformers;

use App\Models\Lead;

/**
 * Transforms Lead Eloquent models to gRPC message arrays.
 * Uses flat structure with ID references only (no nested objects).
 */
class LeadTransformer
{
    /**
     * Transform a Lead model to a gRPC-compatible array.
     *
     * @param Lead $lead
     * @return array
     */
    public function transform(Lead $lead): array
    {
        return [
            'id' => (int) $lead->id,
            'client_name' => (string) ($lead->client_name ?? ''),
            'client_email' => (string) ($lead->client_email ?? ''),
            'company_name' => (string) ($lead->company_name ?? ''),
            
            // Personal info
            'salutation' => (string) ($lead->salutation?->value ?? $lead->salutation ?? ''),
            'gender' => (string) ($lead->gender?->value ?? $lead->gender ?? ''),
            'contact_type' => (string) ($lead->contact_type?->value ?? $lead->contact_type ?? ''),
            
            // Contact details
            'mobile' => (string) ($lead->mobile ?? ''),
            'cell' => (string) ($lead->cell ?? ''),
            'office' => (string) ($lead->office ?? ''),
            'website' => (string) ($lead->website ?? ''),
            
            // Address
            'address' => (string) ($lead->address ?? ''),
            'city' => (string) ($lead->city ?? ''),
            'state' => (string) ($lead->state ?? ''),
            'country' => (string) ($lead->country ?? ''),
            'postal_code' => (string) ($lead->postal_code ?? ''),
            
            // Foreign key references (flat)
            'source_id' => (int) ($lead->source_id ?? 0),
            'status_id' => (int) ($lead->status_id ?? 0),
            'category_id' => (int) ($lead->category_id ?? 0),
            'agent_id' => (int) ($lead->agent_id ?? 0),
            'currency_id' => (int) ($lead->currency_id ?? 0),
            'company_id' => (int) ($lead->company_id ?? 0),
            'lead_owner' => (int) ($lead->lead_owner ?? 0),
            'added_by' => (int) ($lead->added_by ?? 0),
            'last_updated_by' => (int) ($lead->last_updated_by ?? 0),
            
            // Value and priority
            'total_value' => (float) ($lead->total_value ?? 0),
            'column_priority' => (int) ($lead->column_priority ?? 0),
            'next_follow_up' => $this->formatDateTime($lead->next_follow_up),
            
            // Metadata
            'created_at' => $this->formatDateTime($lead->created_at),
            'updated_at' => $this->formatDateTime($lead->updated_at),
        ];
    }

    /**
     * Transform a collection of leads.
     *
     * @param iterable $leads
     * @return array
     */
    public function transformCollection(iterable $leads): array
    {
        $result = [];
        foreach ($leads as $lead) {
            $result[] = $this->transform($lead);
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
