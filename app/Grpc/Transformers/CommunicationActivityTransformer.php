<?php

namespace App\Grpc\Transformers;

use App\Models\CommunicationActivity;

/**
 * Transforms CommunicationActivity Eloquent models to gRPC message arrays.
 */
class CommunicationActivityTransformer
{
    /**
     * Transform a CommunicationActivity model to a gRPC-compatible array.
     *
     * @param CommunicationActivity $activity
     * @return array
     */
    public function transform(CommunicationActivity $activity): array
    {
        return [
            'id' => (int) $activity->id,
            'company_id' => (int) ($activity->company_id ?? 0),
            'deal_id' => (int) ($activity->deal_id ?? 0),
            'lead_id' => (int) ($activity->lead_id ?? 0),
            'parent_activity_id' => (int) ($activity->parent_activity_id ?? 0),
            'channel_type' => (string) ($activity->channel_type ?? ''),
            'resolution_status' => (string) ($activity->resolution_status ?? ''),
            'resolution_attempts' => (int) ($activity->resolution_attempts ?? 0),
            'message_content' => (string) ($activity->message_content ?? ''),
            'sender_info' => is_array($activity->sender_info) || is_object($activity->sender_info) ? json_encode($activity->sender_info) : (string) ($activity->sender_info ?? ''),
            'timestamp' => $this->formatDateTime($activity->timestamp),
            'metadata' => is_array($activity->metadata) || is_object($activity->metadata) ? json_encode($activity->metadata) : (string) ($activity->metadata ?? ''),
            'email' => (string) ($activity->email ?? ''),
            'phone_number' => (string) ($activity->phone_number ?? ''),
            'instagram_username' => (string) ($activity->instagram_username ?? ''),
            'telegram_username' => (string) ($activity->telegram_username ?? ''),
            'whatsapp_username' => (string) ($activity->whatsapp_username ?? ''),
            'first_name' => (string) ($activity->first_name ?? ''),
            'last_name' => (string) ($activity->last_name ?? ''),
            'message_type' => (string) ($activity->message_type ?? ''),
            'subject' => (string) ($activity->subject ?? ''),
            'last_resolution_attempt_at' => $this->formatDateTime($activity->last_resolution_attempt_at),
            'chat_id' => (string) ($activity->chat_id ?? ''),
            'created_at' => $this->formatDateTime($activity->created_at),
            'updated_at' => $this->formatDateTime($activity->updated_at),
        ];
    }

    /**
     * Transform a collection of communication activities.
     *
     * @param iterable $activities
     * @return array
     */
    public function transformCollection(iterable $activities): array
    {
        $result = [];
        foreach ($activities as $activity) {
            $result[] = $this->transform($activity);
        }
        return $result;
    }

    /**
     * Format a datetime value to ISO 8601 string.
     *
     * @param mixed $value
     * @return string
     */
    private function formatDateTime(mixed $value): string
    {
        if ($value === null) return '';
        if ($value instanceof \DateTimeInterface) return $value->format('c');
        return (string) $value;
    }
}
