<?php

namespace App\Grpc\Transformers;

use App\Models\Country;

/**
 * Transforms Country Eloquent models to gRPC message arrays.
 */
class CountryTransformer
{
    /**
     * Transform a Country model to a gRPC-compatible array.
     *
     * @param Country $country
     * @return array
     */
    public function transform(Country $country): array
    {
        return [
            'id' => (int) $country->id,
            'iso' => (string) ($country->iso ?? ''),
            'name' => (string) ($country->name ?? ''),
            'nicename' => (string) ($country->nicename ?? ''),
            'iso3' => (string) ($country->iso3 ?? ''),
            'numcode' => (int) ($country->numcode ?? 0),
            'phonecode' => (int) ($country->phonecode ?? 0),
        ];
    }

    /**
     * Transform a collection of countries.
     *
     * @param iterable $countries
     * @return array
     */
    public function transformCollection(iterable $countries): array
    {
        $result = [];
        foreach ($countries as $country) {
            $result[] = $this->transform($country);
        }
        return $result;
    }
}
