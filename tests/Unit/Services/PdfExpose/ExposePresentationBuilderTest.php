<?php

namespace Tests\Unit\Services\PdfExpose;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use App\Services\PdfExpose\ExposeClientDto;
use App\Services\PdfExpose\ExposePresentationBuilder;
use PHPUnit\Framework\TestCase;

class ExposePresentationBuilderTest extends TestCase
{
    public function test_to_client_dto_always_returns_stable_keys_and_empty_arrays(): void
    {
        $config = $this->makeConfig([
            'title' => 'Sample',
            'assets' => [],
            'agent' => [],
            'client' => [],
            'company' => [],
        ]);

        $dto = ExposePresentationBuilder::from($config)->toClientDto()->toArray();

        $this->assertSame(ExposeClientDto::SCHEMA_VERSION, $dto['schema_version']);
        $this->assertSame([], $dto['facility_items']);
        $this->assertSame([], $dto['infrastructure_items']);
        $this->assertIsArray($dto['airport_items']);
        $this->assertCount(3, $dto['airport_items']);
        $this->assertSame('fallback', $dto['airport_items'][0]['source']);
        $this->assertArrayHasKey('hero', $dto['assets']);
        $this->assertSame([], $dto['assets']['hero']);
        $this->assertFalse($dto['presence']['facilities']);
        $this->assertFalse($dto['presence']['agent']);
        $this->assertFalse($dto['presence']['airports']);
    }

    public function test_facility_items_prefer_slug_tagged_images_then_defaults_then_generic(): void
    {
        $config = $this->makeConfig([
            'facilities' => ['pool', 'gym'],
            'facility_labels' => ['Swimming Pool', 'Gym'],
            'facility_images_by_slug' => [
                'pool' => ['https://cdn.example/pool.jpg'],
                'gym' => [],
            ],
            'facility_default_images_by_slug' => [
                'pool' => 'https://cdn.example/pool-default.jpg',
                'gym' => 'https://cdn.example/gym-default.jpg',
            ],
            'assets' => [
                'facilities' => ['https://cdn.example/generic-1.jpg'],
            ],
        ]);

        $items = ExposePresentationBuilder::from($config)->toClientDto()->toArray()['facility_items'];

        $this->assertCount(2, $items);
        $this->assertSame('pool', $items[0]['slug']);
        $this->assertSame('Swimming Pool', $items[0]['label']);
        $this->assertSame('https://cdn.example/pool.jpg', $items[0]['image_url']);
        $this->assertSame('gym', $items[1]['slug']);
        $this->assertSame('https://cdn.example/gym-default.jpg', $items[1]['image_url']);
        $this->assertTrue(ExposePresentationBuilder::from($config)->toClientDto()->toArray()['presence']['facilities']);
    }

    public function test_airport_fallbacks_are_marked_as_fallback_source(): void
    {
        $config = $this->makeConfig([
            'location_airports' => [
                [
                    'name' => 'Real Airport',
                    'code' => 'ECN',
                    'travelTimeInMin' => 40,
                    'image' => 'https://cdn.example/airport.jpg',
                ],
            ],
            'assets' => [
                'exterior' => [
                    'https://cdn.example/ext-0.jpg',
                    'https://cdn.example/ext-1.jpg',
                    'https://cdn.example/ext-2.jpg',
                ],
            ],
        ]);

        $airports = ExposePresentationBuilder::from($config)->toClientDto()->toArray()['airport_items'];

        $this->assertCount(3, $airports);
        $this->assertSame('location', $airports[0]['source']);
        $this->assertSame('Real Airport', $airports[0]['name']);
        $this->assertSame('fallback', $airports[1]['source']);
        $this->assertSame('Larnaca International', $airports[1]['name']);
        $this->assertSame('fallback', $airports[2]['source']);
        $this->assertTrue(ExposePresentationBuilder::from($config)->toClientDto()->toArray()['presence']['airports']);
    }

    public function test_to_pdf_props_includes_blade_aliases(): void
    {
        $config = $this->makeConfig([
            'facilities' => ['pool'],
            'facility_labels' => ['Pool'],
            'facility_images_by_slug' => ['pool' => ['https://cdn.example/pool.jpg']],
            'facility_default_images_by_slug' => [],
            'assets' => [
                'hero' => ['https://cdn.example/hero.jpg'],
                'interior' => ['https://cdn.example/int.jpg'],
            ],
            'location_payload' => ['name' => 'iskele_area', 'description' => 'Nice', 'image_url' => null],
        ]);

        $props = ExposePresentationBuilder::from($config)->toPdfProps();

        $this->assertSame('https://cdn.example/hero.jpg', $props['backgroundImageFallback']);
        $this->assertSame('iskele area', $props['locationTitle']);
        $this->assertSame('Pool', $props['facilityItems'][0]['label']);
        $this->assertSame('https://cdn.example/pool.jpg', $props['facilityItems'][0]['image']);
        $this->assertArrayHasKey('airportItems', $props);
        $this->assertArrayHasKey('infraItems', $props);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function makeConfig(array $data): ExposeConfiguration
    {
        return new ExposeConfiguration(
            entityType: 'property',
            entityId: 1,
            layout: 'expose-template',
            sections: [],
            data: $data,
        );
    }
}
