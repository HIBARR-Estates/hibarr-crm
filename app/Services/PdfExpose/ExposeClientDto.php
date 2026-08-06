<?php

namespace App\Services\PdfExpose;

/**
 * Lite expose presentation DTO for OL / external consumers (schema_version 1).
 *
 * Stable contract — arrays are always present (never null). People objects are
 * always present; use `presence` to detect meaningful population.
 *
 * @phpstan-type FacilityItem array{slug: string|null, label: string, image_url: string|null}
 * @phpstan-type InfraItem array{name: string, travel_time_in_min: mixed, image_url: string|null, icon: string|null}
 * @phpstan-type AirportItem array{name: string, travel_time_in_min: mixed, image_url: string|null, code: string|null, source: string}
 * @phpstan-type AttractionItem array{name: string, description: string, primary_image_url: string|null, secondary_image_url: string|null}
 * @phpstan-type CompletionInfo array{raw: mixed, display: string|null, is_ready: bool}
 * @phpstan-type LocationInfo array{title: string|null, description: string|null, image_url: string|null}
 * @phpstan-type OutroInfo array{title: string, description: string, primary_image_url: string|null, secondary_image_url: string|null}
 * @phpstan-type PersonInfo array{name: string|null, email: string|null, phone?: string|null, position?: string|null, image?: string|null}
 * @phpstan-type CompanyInfo array{name: string|null, company_name: string|null, logo: string|null, address: string|null, phone: string|null, email: string|null, website: string|null}
 * @phpstan-type PresenceInfo array{agent: bool, client: bool, facilities: bool, infrastructure: bool, airports: bool, cover: bool, floor_plan: bool}
 * @phpstan-type AssetsMap array<string, list<string>>
 */
class ExposeClientDto
{
    public const SCHEMA_VERSION = 1;

    public const ASSET_TAGS = [
        'hero',
        'cover',
        'area',
        'exterior',
        'interior',
        'floor-plan',
        'facilities',
        'gallery',
        'footer',
        'site-plan',
    ];

    /**
     * @param  FacilityItem[]  $facilityItems
     * @param  InfraItem[]  $infrastructureItems
     * @param  AirportItem[]  $airportItems
     * @param  AssetsMap  $assets
     * @param  list<string>  $unitStyleList
     * @param  AttractionItem[]  $attractions
     * @param  CompletionInfo  $completion
     * @param  LocationInfo  $location
     * @param  OutroInfo  $outro
     * @param  PersonInfo  $agent
     * @param  PersonInfo  $client
     * @param  CompanyInfo  $company
     * @param  PresenceInfo  $presence
     */
    public function __construct(
        public readonly int $schemaVersion,
        public readonly string $entityType,
        public readonly int $entityId,
        public readonly string $layout,
        public readonly array $facilityItems,
        public readonly array $infrastructureItems,
        public readonly array $airportItems,
        public readonly array $assets,
        public readonly ?string $backgroundImageUrl,
        public readonly array $unitStyleList,
        public readonly array $completion,
        public readonly array $location,
        public readonly array $attractions,
        public readonly array $outro,
        public readonly array $agent,
        public readonly array $client,
        public readonly array $company,
        public readonly array $presence,
        public readonly ?string $title = null,
        public readonly ?string $description = null,
        public readonly ?string $city = null,
        public readonly ?string $price = null,
        public readonly mixed $rawPrice = null,
        public readonly ?string $displayLabel = null,
        public readonly ?string $blockName = null,
        public readonly mixed $bedrooms = null,
        public readonly mixed $livingRoom = null,
        /** @var array<string, mixed> */
        public readonly array $extra = [],
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return array_merge([
            'schema_version' => $this->schemaVersion,
            'entity_type' => $this->entityType,
            'entity_id' => $this->entityId,
            'layout' => $this->layout,
            'title' => $this->title,
            'description' => $this->description,
            'city' => $this->city,
            'price' => $this->price,
            'raw_price' => $this->rawPrice,
            'display_label' => $this->displayLabel,
            'block_name' => $this->blockName,
            'bedrooms' => $this->bedrooms,
            'living_room' => $this->livingRoom,
            'facility_items' => $this->facilityItems,
            'infrastructure_items' => $this->infrastructureItems,
            'airport_items' => $this->airportItems,
            'assets' => $this->assets,
            'background_image_url' => $this->backgroundImageUrl,
            'unit_style_list' => $this->unitStyleList,
            'completion' => $this->completion,
            'location' => $this->location,
            'attractions' => $this->attractions,
            'outro' => $this->outro,
            'agent' => $this->agent,
            'client' => $this->client,
            'company' => $this->company,
            'presence' => $this->presence,
        ], $this->extra);
    }
}
