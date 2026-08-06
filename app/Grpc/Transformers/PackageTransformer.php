<?php

namespace App\Grpc\Transformers;

use App\Models\Package;

/**
 * Transforms Package Eloquent models to gRPC message arrays.
 */
class PackageTransformer
{
    /**
     * Transform a Package model to a gRPC-compatible array.
     *
     * @param Package $package
     * @return array
     */
    public function transform(Package $package): array
    {
        return [
            'id' => (int) $package->id,
            'company_id' => (int) ($package->company_id ?? 0),
            'name' => (string) ($package->name ?? ''),
            'value' => (float) ($package->value ?? 0),
            'description' => (string) ($package->description ?? ''),
            'customer_type_name' => (string) ($package->customer_type_name ?? ''),
            'customer_type_description' => (string) ($package->customer_type_description ?? ''),
            'created_at' => $this->formatDateTime($package->created_at),
            'updated_at' => $this->formatDateTime($package->updated_at),
            'deleted_at' => $this->formatDateTime($package->deleted_at),
            'currency' => (string) ($package->currency ?? 'EUR'),
        ];
    }

    /**
     * Transform a collection of packages.
     *
     * @param iterable $packages
     * @return array
     */
    public function transformCollection(iterable $packages): array
    {
        $result = [];
        foreach ($packages as $package) {
            $result[] = $this->transform($package);
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
