<?php

namespace App\Grpc\Transformers;

use App\Models\MeetingType;

/**
 * Transforms MeetingType Eloquent models to gRPC message arrays.
 */
class MeetingTypeTransformer
{
    /**
     * Transform a MeetingType model to a gRPC-compatible array.
     *
     * @param MeetingType $meetingType
     * @return array
     */
    public function transform(MeetingType $meetingType): array
    {
        return [
            'id' => (int) $meetingType->id,
            'company_id' => (int) ($meetingType->company_id ?? 0),
            'name' => (string) ($meetingType->name ?? ''),
            'description' => (string) ($meetingType->description ?? ''),
            'color' => (string) ($meetingType->color ?? ''),
            'is_active' => (bool) ($meetingType->is_active ?? false),
            'created_at' => $this->formatDateTime($meetingType->created_at),
            'updated_at' => $this->formatDateTime($meetingType->updated_at),
        ];
    }

    /**
     * Transform a collection of meeting types.
     *
     * @param iterable $meetingTypes
     * @return array
     */
    public function transformCollection(iterable $meetingTypes): array
    {
        $result = [];
        foreach ($meetingTypes as $meetingType) {
            $result[] = $this->transform($meetingType);
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
