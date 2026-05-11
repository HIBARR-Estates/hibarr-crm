<?php

namespace App\Services\AiDescription;

use App\Contracts\PropertyDescriptionInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class HibarrPropertyDescriptionService implements PropertyDescriptionInterface
{
    private string $baseUrl;
    private int $timeout;
    private string $provider;
    private string $model;
    private ?string $apiKey;

    /**
     * @var array<string, string>
     */
    private const FIELD_LABELS = [
        'property_type' => 'Property Type',
        'primary_category' => 'Category',
        'unit_style' => 'Unit Style',
        'sale_type' => 'Listing Type',
        'price' => 'Asking Price',
        'city' => 'City',
        'area' => 'Area / Neighbourhood',
        'bedrooms' => 'Bedrooms',
        'bathrooms' => 'Bathrooms',
        'living_room' => 'Living Rooms',
        'living_area_sqm' => 'Internal Area (m2)',
        'gross_sqm' => 'Gross Area (m2)',
        'land_size' => 'Plot Size (m2)',
        'floor_number' => 'Floor',
        'floors_in_building' => 'Floors in Building',
        'building_age' => 'Building Age',
        'furniture_status' => 'Furniture Status',
        'construction_status' => 'Construction Status',
        'interior_features' => 'Interior Features',
        'exterior_features' => 'Exterior Features',
        'location_features' => 'Location Features',
        'view_types' => 'View',
        'heating_type' => 'Heating Type',
        'balcony_net_sqm' => 'Balcony / Terrace Area (m2)',
        'within_site' => 'Within a Residence / Project',
        'name' => 'Project Name',
        'starting_price' => 'Starting Price',
        'number_of_units' => 'Number of Units',
        'number_of_blocks' => 'Number of Blocks',
        'project_total_area_sqm' => 'Total Project Area (m2)',
        'number_of_phases' => 'Number of Phases',
        'furniture_package' => 'Furniture Package',
        'rental_guarantee' => 'Rental Guarantee',
        'facilities' => 'Facilities',
        'primary_categories' => 'Property Types Available',
        'title_deed_type' => 'Title Deed Type',
        'total_area_sqm' => 'Total Area (m2)',
        'terrace_balcony_sqm' => 'Terrace / Balcony Area (m2)',
        'plot_size_sqm' => 'Plot Size (m2)',
        'floor' => 'Floor',
        'outside_features' => 'Outside Features',
        'inside_features' => 'Inside Features',
        'military_base_distance_km' => 'Distance to Military Base (km)',
        'currency' => 'Currency',
        'reference_code' => 'Reference Code',
    ];

    /**
     * @var array<string, string>
     */
    private const LOCATION_FIELD_LABELS = [
        'name' => 'Location Name',
        'description' => 'Location Description',
        'map_url' => 'Location Image URL',
        'address.street' => 'Street Address',
        'address.city' => 'City',
        'address.state' => 'State / Region',
        'address.country' => 'Country',
        'address.postalCode' => 'Postal Code',
        'attractions' => 'Nearby Attractions',
        'infrastructure' => 'Nearby Infrastructure',
        'airports' => 'Nearby Airports',
    ];

    /**
     * @var array<int, string>
     */
    private const EXCLUDED_PROMPT_KEYS = [
        'name',
        'developer_id',
        'developer_name',
    ];

    private const SYSTEM_INSTRUCTION = <<<'PROMPT'
You are a professional real estate copywriter specialising in North Cyprus (TRNC) properties.

Rules:
- Write a compelling property listing description in English.
- Length: 150-300 words.
- Tone: professional, warm, and inviting - suitable for an international buyer audience.
- Highlight key selling points based on the provided details.
- Mention location and lifestyle benefits when the city/area is known.
- If this is a construction project, focus on the development as a whole - mention the project scale, available unit types, facilities, payment plans, and completion timeline where available.
- Do NOT mention the project name or the construction company / developer name anywhere in the description.
- Do NOT invent features that are not listed - only embellish what is provided.
- Do NOT include a title/heading - return only the body description.
- Output plain text only (no markdown, no bullet points, no HTML).
PROMPT;

    private const LOCATION_SYSTEM_INSTRUCTION = <<<'PROMPT'
You are a professional real estate copywriter specialising in North Cyprus (TRNC) project locations.

Rules:
- Write a compelling location description in English.
- Length: 120-220 words.
- Tone: professional, warm, and useful for a project brochure or expose PDF.
- Highlight the location's setting, address context, and nearby lifestyle benefits.
- Mention nearby attractions, infrastructure, and airports only if they are provided.
- Do NOT invent details that are not listed.
- Do NOT include a title/heading - return only the body description.
- Output plain text only (no markdown, no bullet points, no HTML).
PROMPT;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) config('services.ai.base_url'), '/');
        $this->timeout = (int) config('services.ai.timeout', 45);
        $this->provider = (string) config('services.ai.provider', 'openai');
        $this->model = (string) config('services.ai.model', 'gpt-4o');

        $apiKey = config('services.ai.api_key');
        $this->apiKey = is_string($apiKey) ? trim($apiKey) : null;
    }

    public function generate(array $formData, ?string $featureContext = null): string
    {
        $isLocationContext = $featureContext === 'location_description';
        $context = $isLocationContext
            ? $this->buildLocationContext($formData)
            : $this->buildPropertyContext($formData);

        if ($context === '') {
            throw new \RuntimeException(
                $isLocationContext
                    ? 'No location details available to generate a description.'
                    : 'No property details available to generate a description.'
            );
        }

        $featureContextName = $isLocationContext
            ? 'location_description'
            : 'property_description';

        $systemInstruction = $isLocationContext
            ? self::LOCATION_SYSTEM_INSTRUCTION
            : self::SYSTEM_INSTRUCTION;

        try {
            $request = Http::timeout($this->timeout);

            if (!empty($this->apiKey)) {
                $request = $request->withHeaders([
                    'x-api-key' => $this->apiKey,
                ]);
            }

            $response = $request->post("{$this->baseUrl}/ai/execute", [
                'featureContext' => $featureContextName,
                'userId' => (string) auth()->id(),
                'payload' => [
                    'messages' => [
                        ['role' => 'system', 'content' => $systemInstruction],
                        [
                            'role' => 'user',
                            'content' => $isLocationContext
                                ? "Generate a location description based on these details:\n\n{$context}"
                                : "Generate a property listing description based on these details:\n\n{$context}",
                        ],
                    ],
                    'maxTokens' => 1024,
                ],
                'routingPreference' => [
                    'provider' => $this->provider,
                    'model' => $this->model,
                    'fallbackEnabled' => true,
                ],
            ]);

            if ($response->failed()) {
                Log::error('AI Property Description API error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'url' => "{$this->baseUrl}/ai/execute",
                ]);

                throw new \RuntimeException('AI description generation failed with status ' . $response->status());
            }

            $data = $response->json();
            $completion = trim((string) ($data['data']['completion'] ?? ''));

            if (!($data['success'] ?? false) || $completion === '') {
                Log::warning('AI Property Description unexpected response', ['response' => $data]);

                throw new \RuntimeException('AI description generation returned an invalid response.');
            }

            return $completion;
        }
        catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('AI Property Description connection timeout', ['message' => $e->getMessage()]);

            throw new \RuntimeException('timeout', 0, $e);
        }
        catch (\Throwable $e) {
            Log::error('AI Property Description unexpected error', [
                'message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * @param  array<string, mixed>  $formData
     */
    private function buildPropertyContext(array $formData): string
    {
        $lines = [];

        foreach (self::FIELD_LABELS as $key => $label) {
            if (in_array($key, self::EXCLUDED_PROMPT_KEYS, true)) {
                continue;
            }

            if (!array_key_exists($key, $formData)) {
                continue;
            }

            $value = $formData[$key];

            if ($value === null || $value === '' || $value === false) {
                continue;
            }

            if (is_array($value)) {
                if ($value === []) {
                    continue;
                }

                $serializedValues = array_map(static function ($item): string {
                    if (is_scalar($item)) {
                        return (string) $item;
                    }

                    return json_encode($item, JSON_UNESCAPED_UNICODE) ?: '';
                }, $value);

                $serializedValues = array_values(array_filter($serializedValues, static fn ($item) => $item !== ''));

                if ($serializedValues === []) {
                    continue;
                }

                $lines[] = $label . ': ' . implode(', ', $serializedValues);
                continue;
            }

            if (is_bool($value)) {
                $lines[] = $label . ': Yes';
                continue;
            }

            $lines[] = $label . ': ' . (string) $value;
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array<string, mixed>  $formData
     */
    private function buildLocationContext(array $formData): string
    {
        $lines = [];

        foreach (self::LOCATION_FIELD_LABELS as $key => $label) {
            $value = $this->dataGet($formData, $key);

            if ($value === null || $value === '' || $value === false) {
                continue;
            }

            if (is_array($value)) {
                if ($value === []) {
                    continue;
                }

                $serializedValues = array_map(static function ($item): string {
                    if (is_scalar($item)) {
                        return (string) $item;
                    }

                    return json_encode($item, JSON_UNESCAPED_UNICODE) ?: '';
                }, $value);

                $serializedValues = array_values(array_filter($serializedValues, static fn ($item) => $item !== ''));

                if ($serializedValues === []) {
                    continue;
                }

                $lines[] = $label . ': ' . implode(', ', $serializedValues);
                continue;
            }

            if (is_bool($value)) {
                $lines[] = $label . ': ' . ($value ? 'Yes' : 'No');
                continue;
            }

            $lines[] = $label . ': ' . (string) $value;
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function dataGet(array $data, string $key): mixed
    {
        $segments = explode('.', $key);
        $current = $data;

        foreach ($segments as $segment) {
            if (!is_array($current) || !array_key_exists($segment, $current)) {
                return null;
            }

            $current = $current[$segment];
        }

        return $current;
    }
}
