<?php

namespace App\Grpc\Transformers;

use App\Models\LeadMarketing;

/**
 * Transforms LeadMarketing Eloquent models to gRPC message arrays.
 */
class LeadMarketingTransformer
{
    /**
     * Transform a LeadMarketing model to a gRPC-compatible array.
     *
     * @param LeadMarketing $leadMarketing
     * @return array
     */
    public function transform(LeadMarketing $leadMarketing): array
    {
        return [
            'id' => (int) $leadMarketing->id,
            'lead_id' => (int) ($leadMarketing->lead_id ?? 0),
            'utm_source' => (string) ($leadMarketing->utm_source ?? ''),
            'utm_medium' => (string) ($leadMarketing->utm_medium ?? ''),
            'utm_campaign' => (string) ($leadMarketing->utm_campaign ?? ''),
            'utm_term' => (string) ($leadMarketing->utm_term ?? ''),
            'utm_content' => (string) ($leadMarketing->utm_content ?? ''),
            'referrer_url' => (string) ($leadMarketing->referrer_url ?? ''),
            'landing_page_url' => (string) ($leadMarketing->landing_page_url ?? ''),
            'page_title' => (string) ($leadMarketing->page_title ?? ''),
            'page_url' => (string) ($leadMarketing->page_url ?? ''),
            'ip_address' => (string) ($leadMarketing->ip_address ?? ''),
            'device_type' => (string) ($leadMarketing->device_type ?? ''),
            'browser' => (string) ($leadMarketing->browser ?? ''),
            'operating_system' => (string) ($leadMarketing->operating_system ?? ''),
            'screen_resolution' => (string) ($leadMarketing->screen_resolution ?? ''),
            'gclid' => (string) ($leadMarketing->gclid ?? ''),
            'fbclid' => (string) ($leadMarketing->fbclid ?? ''),
            'fb_event_id' => (string) ($leadMarketing->fb_event_id ?? ''),
            'fb_pixel_id' => (string) ($leadMarketing->fb_pixel_id ?? ''),
            'fbc' => (string) ($leadMarketing->fbc ?? ''),
            'fbp' => (string) ($leadMarketing->fbp ?? ''),
            'created_at' => $this->formatDateTime($leadMarketing->created_at),
            'updated_at' => $this->formatDateTime($leadMarketing->updated_at),
        ];
    }

    /**
     * Transform a collection of lead marketing records.
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
