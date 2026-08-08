<?php

namespace App\Services\PdfExpose;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use Carbon\Carbon;

/**
 * Shared presentation layer for expose PDF Blade and OL lite DTO consumers.
 *
 * Lifts transform logic formerly embedded in expose-template.blade.php so both
 * consumers share one source of truth for facilities, infra, airports, assets, etc.
 */
class ExposePresentationBuilder
{
    private const FALLBACK_AIRPORT_NAMES = [
        'Ercan International',
        'Larnaca International',
        'Paphos International',
    ];

    private const PLACEHOLDER_IMAGE = 'property/images/test.png';

    public function __construct(
        private readonly ExposeConfiguration $config
    ) {}

    public static function from(ExposeConfiguration $config): self
    {
        return new self($config);
    }

    /**
     * Lite semantic DTO for OL / API consumers (no branding / page chrome).
     */
    public function toClientDto(): ExposeClientDto
    {
        $data = $this->config->data;
        $resolved = $this->resolvePresentation($data);

        $agent = $this->normalizePerson($data['agent'] ?? []);
        $client = [
            'name' => $this->nullableString($data['client']['name'] ?? null),
            'email' => $this->nullableString($data['client']['email'] ?? null),
        ];
        $company = $this->normalizeCompany($data['company'] ?? []);

        return new ExposeClientDto(
            schemaVersion: ExposeClientDto::SCHEMA_VERSION,
            entityType: $this->config->entityType,
            entityId: $this->config->entityId,
            layout: $this->config->layout,
            facilityItems: $resolved['facility_items'],
            infrastructureItems: $resolved['infrastructure_items'],
            airportItems: $resolved['airport_items'],
            assets: $resolved['assets'],
            backgroundImageUrl: $resolved['background_image_url'],
            unitStyleList: $resolved['unit_style_list'],
            completion: $resolved['completion'],
            location: $resolved['location'],
            attractions: $resolved['attractions'],
            outro: $resolved['outro'],
            agent: $agent,
            client: $client,
            company: $company,
            presence: [
                'agent' => filled($agent['name'] ?? null),
                'client' => filled($client['name'] ?? null),
                'facilities' => $resolved['facility_items'] !== [],
                'infrastructure' => $resolved['infrastructure_items'] !== [],
                'airports' => collect($resolved['airport_items'])->contains(
                    fn (array $item) => ($item['source'] ?? null) !== 'fallback'
                ),
                'cover' => ($resolved['assets']['cover'] ?? []) !== [],
                'floor_plan' => ($resolved['assets']['floor-plan'] ?? []) !== [],
            ],
            title: $this->nullableString($data['title'] ?? null),
            description: isset($data['description']) ? (string) $data['description'] : null,
            city: $this->nullableString($data['city'] ?? null),
            price: $this->nullableString(isset($data['price']) ? (string) $data['price'] : null),
            rawPrice: $data['raw_price'] ?? null,
            displayLabel: $this->nullableString($data['display_label'] ?? null),
            blockName: $this->nullableString($data['block_name'] ?? null),
            bedrooms: $data['bedrooms'] ?? null,
            livingRoom: $data['living_room'] ?? null,
            extra: array_filter([
                'reference_code' => $data['reference_code'] ?? null,
                'property_type' => $data['property_type'] ?? null,
                'unit_types' => $data['unit_types'] ?? null,
                'developer_name' => $data['developer_name'] ?? null,
            ], fn ($v) => $v !== null),
        );
    }

    /**
     * PDF Blade props — original config data plus resolved presentation keys.
     *
     * @return array<string, mixed>
     */
    public function toPdfProps(): array
    {
        $data = $this->config->data;
        $resolved = $this->resolvePresentation($data);

        return array_merge($data, [
            'facility_items' => $resolved['facility_items'],
            'infrastructure_items' => $resolved['infrastructure_items'],
            'airport_items' => $resolved['airport_items'],
            'assets' => $resolved['assets'],
            'background_image_url' => $resolved['background_image_url'],
            'backgroundImageFallback' => $resolved['background_image_url'],
            'heroImages' => $resolved['hero_images'],
            'coverImages' => $resolved['cover_images'],
            'exteriorImages' => $resolved['exterior_images'],
            'galleryImages' => $resolved['gallery_images'],
            'unit_style_list' => $resolved['unit_style_list'],
            'unitStyleList' => $resolved['unit_style_list'],
            'completion' => $resolved['completion'],
            'location_title' => $resolved['location']['title'],
            'location_description' => $resolved['location']['description'],
            'location_image' => $resolved['location']['image_url'],
            'locationTitle' => $resolved['location']['title'],
            'locationDescription' => $resolved['location']['description'],
            'locationImage' => $resolved['location']['image_url'],
            'location_attractions' => $resolved['attractions'],
            'locationAttractions' => $resolved['attractions'],
            'outro_title' => $resolved['outro']['title'],
            'outro_description' => $resolved['outro']['description'],
            'outro_primary_image' => $resolved['outro']['primary_image_url'],
            'outro_secondary_image' => $resolved['outro']['secondary_image_url'],
            'outroTitle' => $resolved['outro']['title'],
            'outroDescription' => $resolved['outro']['description'],
            'outroPrimaryImage' => $resolved['outro']['primary_image_url'],
            'outroSecondaryImage' => $resolved['outro']['secondary_image_url'],
            'facilityItems' => array_map(function (array $item) {
                return [
                    'slug' => $item['slug'],
                    'label' => $item['label'],
                    'image' => $item['image_url'],
                    'image_url' => $item['image_url'],
                ];
            }, $resolved['facility_items']),
            'location_infrastructure' => $resolved['infrastructure_items_raw'],
            'location_airports' => $resolved['airport_items_raw_before_pad'],
            'locationInfrastructure' => $resolved['infrastructure_items_raw'],
            'locationAirports' => $resolved['airport_items_raw_before_pad'],
            'infraItems' => array_map(function (array $item) {
                return [
                    'name' => $item['name'],
                    'travelTimeInMin' => $item['travel_time_in_min'],
                    'image' => $item['image_url'],
                    'icon' => $item['icon'],
                ];
            }, $resolved['infrastructure_items']),
            'airportItems' => array_map(function (array $item) {
                return [
                    'name' => $item['name'],
                    'travelTimeInMin' => $item['travel_time_in_min'],
                    'image' => $item['image_url'],
                    'code' => $item['code'],
                    'source' => $item['source'],
                ];
            }, $resolved['airport_items']),
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function resolvePresentation(array $data): array
    {
        $assets = $this->normalizeAssets($data['assets'] ?? []);
        $heroImages = array_values($assets['hero']);
        $coverImages = array_values($assets['cover']);
        $exteriorImages = array_values($assets['exterior']);
        $galleryImages = array_values($assets['interior']);

        $backgroundImageUrl = $heroImages[0]
            ?? $exteriorImages[0]
            ?? $galleryImages[0]
            ?? self::PLACEHOLDER_IMAGE;

        $globalExposeConfig = $data['expose_global_config'] ?? [];
        $outroConfig = $globalExposeConfig['outro'] ?? [];

        $outroTitle = $outroConfig['title'] ?? 'ROOTED IN BEAUTY, GROWING IN VALUE';
        $outroDescription = $outroConfig['description']
            ?? (!empty($data['description']) ? (string) $data['description'] : '');
        $outroPrimaryImage = $outroConfig['primary_image_url'] ?? $backgroundImageUrl;
        $outroSecondaryImage = $outroConfig['secondary_image_url']
            ?? ($exteriorImages[4] ?? $outroPrimaryImage);

        $locationPayload = $data['location_payload'] ?? [];
        $locationTitle = !empty($locationPayload['name'])
            ? str_replace('_', ' ', (string) $locationPayload['name'])
            : null;

        $facilityItems = $this->buildFacilityItems($data, $assets);
        $unitStyleList = $this->buildUnitStyleList($data);
        $completion = $this->buildCompletion($data['completion_date'] ?? null);

        $locationInfrastructure = array_values($data['location_infrastructure'] ?? []);
        $locationAirports = array_values($data['location_airports'] ?? []);
        $attractions = array_values($data['location_attractions'] ?? []);

        [$infrastructureItems, $airportItems] = $this->buildInfraAndAirports(
            $data,
            $locationInfrastructure,
            $locationAirports,
            $exteriorImages,
            $galleryImages
        );

        return [
            'assets' => $assets,
            'background_image_url' => $backgroundImageUrl,
            'facility_items' => $facilityItems,
            'unit_style_list' => $unitStyleList,
            'completion' => $completion,
            'location' => [
                'title' => $locationTitle,
                'description' => $locationPayload['description'] ?? null,
                'image_url' => $locationPayload['image_url'] ?? null,
            ],
            'attractions' => array_map(function (array $attraction) use ($backgroundImageUrl, $exteriorImages) {
                return [
                    'name' => $attraction['name'] ?? 'ATTRACTION',
                    'description' => $attraction['description'] ?? '',
                    'primary_image_url' => $attraction['primary_image_url'] ?? $backgroundImageUrl,
                    'secondary_image_url' => $attraction['secondary_image_url']
                        ?? ($exteriorImages[1] ?? $attraction['primary_image_url'] ?? $backgroundImageUrl),
                ];
            }, $attractions),
            'outro' => [
                'title' => (string) $outroTitle,
                'description' => (string) $outroDescription,
                'primary_image_url' => $outroPrimaryImage,
                'secondary_image_url' => $outroSecondaryImage,
            ],
            'infrastructure_items' => $infrastructureItems,
            'airport_items' => $airportItems,
            'infrastructure_items_raw' => $locationInfrastructure,
            'airport_items_raw_before_pad' => $locationAirports,
            'cover_images' => $coverImages,
            'exterior_images' => $exteriorImages,
            'gallery_images' => $galleryImages,
            'hero_images' => $heroImages,
        ];
    }

    /**
     * @param  array<string, mixed>  $raw
     * @return array<string, list<string>>
     */
    private function normalizeAssets(array $raw): array
    {
        $normalized = [];

        foreach (ExposeClientDto::ASSET_TAGS as $tag) {
            $normalized[$tag] = array_values(array_filter(
                array_map('strval', array_values($raw[$tag] ?? [])),
                fn (string $url) => $url !== ''
            ));
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, list<string>>  $assets
     * @return list<array{slug: string|null, label: string, image_url: string|null}>
     */
    private function buildFacilityItems(array $data, array $assets): array
    {
        $facilitySlugs = array_values($data['facilities'] ?? []);
        $facilityLabels = array_values($data['facility_labels'] ?? []);
        $facilityImagesBySlug = $data['facility_images_by_slug'] ?? [];
        $facilityDefaultImagesBySlug = $data['facility_default_images_by_slug'] ?? [];
        $genericFacilityImages = array_values($assets['facilities'] ?? []);

        $facilityItems = [];
        $genericFacilityIndex = 0;

        foreach ($facilitySlugs as $index => $slug) {
            $slugImages = array_values($facilityImagesBySlug[$slug] ?? []);
            $facilityItems[] = [
                'slug' => is_string($slug) ? $slug : null,
                'label' => $facilityLabels[$index]
                    ?? ucfirst(str_replace('_', ' ', (string) $slug)),
                'image_url' => $slugImages[0]
                    ?? ($facilityDefaultImagesBySlug[$slug] ?? ($genericFacilityImages[$genericFacilityIndex++] ?? null)),
            ];
        }

        if ($facilityItems === []) {
            foreach ($facilityLabels as $index => $label) {
                $facilityItems[] = [
                    'slug' => null,
                    'label' => (string) $label,
                    'image_url' => $genericFacilityImages[$index] ?? null,
                ];
            }
        }

        if ($facilityItems === []) {
            foreach (array_values($data['exterior_features'] ?? []) as $index => $label) {
                $facilityItems[] = [
                    'slug' => null,
                    'label' => (string) $label,
                    'image_url' => $genericFacilityImages[$index] ?? null,
                ];
            }
        }

        return $facilityItems;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<string>
     */
    private function buildUnitStyleList(array $data): array
    {
        $unitStyleList = array_values($data['unit_style_list'] ?? []);

        if ($unitStyleList !== []) {
            return array_values(array_filter(array_map('strval', $unitStyleList)));
        }

        if (empty($data['unit_style'])) {
            return [];
        }

        if (is_array($data['unit_style'])) {
            return array_values(array_map('strval', $data['unit_style']));
        }

        return array_values(array_filter(array_map(
            'trim',
            explode('/', (string) $data['unit_style'])
        )));
    }

    /**
     * @return array{raw: mixed, display: string|null, is_ready: bool}
     */
    private function buildCompletion(mixed $completionRaw): array
    {
        if (empty($completionRaw)) {
            return [
                'raw' => null,
                'display' => 'N/A',
                'is_ready' => false,
            ];
        }

        try {
            $completionDt = Carbon::parse($completionRaw);
            $isPast = $completionDt->isPast();

            return [
                'raw' => $completionRaw,
                'display' => $isPast ? 'Ready to move in' : $completionDt->format('d, M, Y'),
                'is_ready' => $isPast,
            ];
        } catch (\Exception) {
            return [
                'raw' => $completionRaw,
                'display' => is_scalar($completionRaw) ? (string) $completionRaw : 'N/A',
                'is_ready' => false,
            ];
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<array<string, mixed>>  $locationInfrastructure
     * @param  list<array<string, mixed>>  $locationAirports
     * @param  list<string>  $exteriorImages
     * @param  list<string>  $galleryImages
     * @return array{0: list<array<string, mixed>>, 1: list<array<string, mixed>>}
     */
    private function buildInfraAndAirports(
        array $data,
        array $locationInfrastructure,
        array $locationAirports,
        array $exteriorImages,
        array $galleryImages
    ): array {
        $distanceList = array_values($data['distances'] ?? []);

        $legacyInfraItems = array_values(array_filter(
            $distanceList,
            fn ($item) => is_array($item) && ($item['type'] ?? null) === 'infrastructure'
        ));
        $legacyAirportItems = array_values(array_filter(
            $distanceList,
            fn ($item) => is_array($item) && ($item['type'] ?? null) === 'airport'
        ));

        $infraSource = $locationInfrastructure !== []
            ? array_slice($locationInfrastructure, 0, 4)
            : array_slice($legacyInfraItems, 0, 4);

        $infrastructureItems = [];
        foreach ($infraSource as $index => $distance) {
            if (!is_array($distance)) {
                continue;
            }

            $travel = $distance['travelTimeInMin']
                ?? $distance['travel_time_in_min']
                ?? $distance['time']
                ?? $distance['distance']
                ?? null;

            $infrastructureItems[] = [
                'name' => (string) ($distance['name'] ?? ''),
                'travel_time_in_min' => $travel,
                'image_url' => $distance['image']
                    ?? $distance['image_url']
                    ?? ($exteriorImages[$index] ?? ($galleryImages[$index] ?? null)),
                'icon' => $distance['icon'] ?? null,
            ];
        }

        $fallbackAirportImages = [
            $exteriorImages[0] ?? ($galleryImages[0] ?? self::PLACEHOLDER_IMAGE),
            $exteriorImages[1] ?? ($galleryImages[1] ?? self::PLACEHOLDER_IMAGE),
            $exteriorImages[2] ?? ($galleryImages[2] ?? self::PLACEHOLDER_IMAGE),
        ];

        $airportSource = $locationAirports !== []
            ? array_slice($locationAirports, 0, 3)
            : array_slice($legacyAirportItems, 0, 3);

        $airportSource = array_pad($airportSource, 3, []);

        $airportItems = [];
        foreach ($airportSource as $index => $airportItem) {
            $airportItem = is_array($airportItem) ? $airportItem : [];
            $hasRealName = filled($airportItem['name'] ?? null);
            $fromLocation = $locationAirports !== [] && $hasRealName;
            $fromLegacy = $locationAirports === [] && $hasRealName;

            $name = $hasRealName
                ? (string) $airportItem['name']
                : (self::FALLBACK_AIRPORT_NAMES[$index] ?? '');

            $source = $fromLocation
                ? 'location'
                : ($fromLegacy ? 'legacy' : 'fallback');

            $travel = $airportItem['travelTimeInMin']
                ?? $airportItem['travel_time_in_min']
                ?? $airportItem['time']
                ?? $airportItem['distance']
                ?? '';

            $airportItems[] = [
                'name' => $name,
                'travel_time_in_min' => $travel,
                'image_url' => $airportItem['image']
                    ?? $airportItem['image_url']
                    ?? ($fallbackAirportImages[$index] ?? self::PLACEHOLDER_IMAGE),
                'code' => $airportItem['code'] ?? null,
                'source' => $source,
            ];
        }

        return [$infrastructureItems, $airportItems];
    }

    /**
     * @param  array<string, mixed>  $agent
     * @return array{name: string|null, email: string|null, phone: string|null, position: string|null, image: string|null}
     */
    private function normalizePerson(array $agent): array
    {
        return [
            'name' => $this->nullableString($agent['name'] ?? null),
            'email' => $this->nullableString($agent['email'] ?? null),
            'phone' => $this->nullableString($agent['phone'] ?? null),
            'position' => $this->nullableString($agent['position'] ?? null),
            'image' => $agent['image'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>  $company
     * @return array{name: string|null, company_name: string|null, logo: string|null, address: string|null, phone: string|null, email: string|null, website: string|null}
     */
    private function normalizeCompany(array $company): array
    {
        return [
            'name' => $this->nullableString($company['name'] ?? $company['company_name'] ?? null),
            'company_name' => $this->nullableString($company['company_name'] ?? $company['name'] ?? null),
            'logo' => $company['logo'] ?? null,
            'address' => $this->nullableString($company['address'] ?? null),
            'phone' => $this->nullableString($company['phone'] ?? null),
            'email' => $this->nullableString($company['email'] ?? null),
            'website' => $this->nullableString($company['website'] ?? null),
        ];
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }
}
