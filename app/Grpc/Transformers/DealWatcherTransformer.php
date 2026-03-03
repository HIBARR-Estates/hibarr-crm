<?php

namespace App\Grpc\Transformers;

use App\Models\DealWatcher;

/**
 * Transforms DealWatcher Eloquent models to gRPC message arrays.
 */
class DealWatcherTransformer
{
    /**
     * Transform a DealWatcher model to a gRPC-compatible array.
     *
     * @param DealWatcher $watcher
     * @return array
     */
    public function transform(DealWatcher $watcher): array
    {
        return [
            'id' => (int) $watcher->id,
            'deal_id' => (int) ($watcher->deal_id ?? 0),
            'user_id' => (int) ($watcher->user_id ?? 0),
            'created_at' => $this->formatDateTime($watcher->created_at),
            'updated_at' => $this->formatDateTime($watcher->updated_at),
        ];
    }

    /**
     * Transform a collection of deal watchers.
     *
     * @param iterable $watchers
     * @return array
     */
    public function transformCollection(iterable $watchers): array
    {
        $result = [];
        foreach ($watchers as $watcher) {
            $result[] = $this->transform($watcher);
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
