<?php

namespace Database\Seeders;

use App\Models\Property;
use App\Models\Product;
use App\Models\Company;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PropertySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // First, ensure we have some products to associate properties with
        $products = Product::all();
        
        if ($products->isEmpty()) {
            // Create some sample products if none exist
            $company = Company::first();
            if (!$company) {
                $this->command->info('No company found. Please run CompanySeeder first.');
                return;
            }

            $products = collect([
                Product::create([
                    'name' => 'Luxury Beachfront Villa',
                    'price' => '0.00',
                    'description' => 'Luxury property for real estate',
                    'allow_purchase' => 1,
                    'company_id' => $company->id,
                    'added_by' => 1,
                    'unit_id' => 1,
                ]),
                Product::create([
                    'name' => 'Modern City Apartment',
                    'price' => '0.00',
                    'description' => 'Modern apartment for real estate',
                    'allow_purchase' => 1,
                    'company_id' => $company->id,
                    'added_by' => 1,
                    'unit_id' => 1,
                ]),
                Product::create([
                    'name' => 'Commercial Office Space',
                    'price' => '0.00',
                    'description' => 'Commercial property for real estate',
                    'allow_purchase' => 1,
                    'company_id' => $company->id,
                    'added_by' => 1,
                    'unit_id' => 1,
                ]),
                Product::create([
                    'name' => 'Residential Land Plot',
                    'price' => '0.00',
                    'description' => 'Land for real estate development',
                    'allow_purchase' => 1,
                    'company_id' => $company->id,
                    'added_by' => 1,
                    'unit_id' => 1,
                ]),
                Product::create([
                    'name' => 'Family Townhouse',
                    'price' => '0.00',
                    'description' => 'Family home for real estate',
                    'allow_purchase' => 1,
                    'company_id' => $company->id,
                    'added_by' => 1,
                    'unit_id' => 1,
                ]),
            ]);
        }

        // Sample property data
        $properties = [
            // Housing Properties
            [
                'product_id' => $products->first()->id,
                'property_type' => Property::PROPERTY_TYPE_VILLA,
                'sale_type' => Property::SALE_TYPE_FOR_SALE,
                'price' => 1250000.00,
                'minimal_rental_period' => null,
                'rent_payment_interval' => null,
                'title_deed_type' => Property::TITLE_DEED_TURKISH,
                'title_deed_stage' => Property::TITLE_DEED_STAGE_INDIVIDUAL,
                'status' => Property::STATUS_AVAILABLE,
                'city' => 'Kyrenia',
                'map' => 'https://maps.google.com/?q=35.3431,33.3217',
                'area' => 'Bellapais',
                'land_size' => 800.00,
                'living_room' => '2',
                'bedrooms' => '4',
                'bathrooms' => 3,
                'floor_number' => null,
                'floors_in_building' => 2,
                'building_age' => 5,
                'furniture_status' => Property::FURNITURE_FULLY_FURNISHED,
                'within_site' => true,
                'exterior_features' => ['garden', 'pool', 'terrace', 'parking'],
                'interior_features' => ['central_heating', 'air_conditioning', 'fireplace'],
                'location_features' => ['sea_view', 'near_schools', 'near_shopping'],
                'title' => 'Luxury Beachfront Villa in Bellapais',
                'description' => 'Stunning 4-bedroom villa with panoramic sea views, private pool, and beautifully landscaped gardens. Located in the prestigious Bellapais area with easy access to amenities.',
                'video_url' => 'https://youtube.com/watch?v=sample1',
                'tour_360_url' => 'https://360tour.com/villa1',
                'photos' => [
                    'https://example.com/photo1.jpg',
                    'https://example.com/photo2.jpg',
                    'https://example.com/photo3.jpg'
                ],
                'add_ons' => ['Furniture', 'Pool Maintenance', 'Garden Maintenance'],
            ],
            [
                'product_id' => $products->skip(1)->first()->id,
                'property_type' => Property::PROPERTY_TYPE_APARTMENT,
                'sale_type' => Property::SALE_TYPE_FOR_RENT,
                'price' => 2500.00,
                'minimal_rental_period' => 12,
                'rent_payment_interval' => Property::RENT_PAYMENT_MONTHLY,
                'title_deed_type' => Property::TITLE_DEED_TURKISH,
                'title_deed_stage' => Property::TITLE_DEED_STAGE_INDIVIDUAL,
                'status' => Property::STATUS_AVAILABLE,
                'city' => 'Nicosia',
                'map' => 'https://maps.google.com/?q=35.1856,33.3823',
                'area' => 'Dereboyu',
                'land_size' => null,
                'living_room' => '1',
                'bedrooms' => '2',
                'bathrooms' => 2,
                'floor_number' => 5,
                'floors_in_building' => 8,
                'building_age' => 2,
                'furniture_status' => Property::FURNITURE_PART_FURNISHED,
                'within_site' => true,
                'exterior_features' => ['balcony', 'parking'],
                'interior_features' => ['central_heating', 'air_conditioning', 'elevator'],
                'location_features' => ['city_view', 'near_metro', 'near_shopping'],
                'title' => 'Modern 2BR Apartment in Dereboyu',
                'description' => 'Contemporary apartment in a new development with city views. Features modern amenities and is close to public transportation and shopping centers.',
                'video_url' => null,
                'tour_360_url' => null,
                'photos' => [
                    'https://example.com/apt1.jpg',
                    'https://example.com/apt2.jpg'
                ],
                'add_ons' => ['White Goods'],
            ],
            // Commercial Property
            [
                'product_id' => $products->skip(2)->first()->id,
                'property_type' => Property::PROPERTY_TYPE_OFFICE,
                'sale_type' => Property::SALE_TYPE_FOR_RENT,
                'price' => 4500.00,
                'minimal_rental_period' => 24,
                'rent_payment_interval' => Property::RENT_PAYMENT_MONTHLY,
                'title_deed_type' => Property::TITLE_DEED_TURKISH,
                'title_deed_stage' => Property::TITLE_DEED_STAGE_INDIVIDUAL,
                'status' => Property::STATUS_AVAILABLE,
                'city' => 'Limassol',
                'map' => 'https://maps.google.com/?q=34.6857,33.0443',
                'area' => 'Business District',
                'land_size' => 200.00,
                'living_room' => null,
                'bedrooms' => null,
                'bathrooms' => 2,
                'floor_number' => 3,
                'floors_in_building' => 10,
                'building_age' => 8,
                'furniture_status' => Property::FURNITURE_UNFURNISHED,
                'within_site' => false,
                'exterior_features' => ['parking'],
                'interior_features' => ['central_heating', 'air_conditioning', 'elevator'],
                'location_features' => ['city_view', 'near_metro', 'near_hospital'],
                'title' => 'Premium Office Space in Business District',
                'description' => 'High-quality office space in a prestigious business building. Perfect for corporate headquarters with excellent transport links.',
                'video_url' => null,
                'tour_360_url' => null,
                'photos' => [
                    'https://example.com/office1.jpg'
                ],
                'add_ons' => ['Reception Services'],
            ],
            // Land Property
            [
                'product_id' => $products->skip(3)->first()->id,
                'property_type' => Property::PROPERTY_TYPE_RESIDENTIALLY_ZONED_LAND,
                'sale_type' => Property::SALE_TYPE_FOR_SALE,
                'price' => 350000.00,
                'minimal_rental_period' => null,
                'rent_payment_interval' => null,
                'title_deed_type' => Property::TITLE_DEED_TURKISH,
                'title_deed_stage' => Property::TITLE_DEED_STAGE_LAND,
                'status' => Property::STATUS_AVAILABLE,
                'city' => 'Paphos',
                'map' => 'https://maps.google.com/?q=34.7572,32.4114',
                'area' => 'Coral Bay',
                'land_size' => 1200.00,
                'living_room' => null,
                'bedrooms' => null,
                'bathrooms' => null,
                'floor_number' => null,
                'floors_in_building' => null,
                'building_age' => null,
                'furniture_status' => null,
                'within_site' => false,
                'exterior_features' => null,
                'interior_features' => null,
                'location_features' => ['sea_view', 'near_schools'],
                'title' => 'Premium Residential Land in Coral Bay',
                'description' => 'Excellent opportunity to build your dream home on this prime residential plot with sea views. Located in the sought-after Coral Bay area.',
                'video_url' => null,
                'tour_360_url' => null,
                'photos' => [
                    'https://example.com/land1.jpg'
                ],
                'add_ons' => null,
            ],
            // Under Offer Property
            [
                'product_id' => $products->skip(4)->first()->id,
                'property_type' => Property::PROPERTY_TYPE_TOWNHOUSE,
                'sale_type' => Property::SALE_TYPE_FOR_SALE,
                'price' => 485000.00,
                'minimal_rental_period' => null,
                'rent_payment_interval' => null,
                'title_deed_type' => Property::TITLE_DEED_TURKISH,
                'title_deed_stage' => Property::TITLE_DEED_STAGE_INDIVIDUAL,
                'status' => Property::STATUS_UNDER_OFFER,
                'city' => 'Famagusta',
                'map' => 'https://maps.google.com/?q=35.1264,33.9461',
                'area' => 'Salamis',
                'land_size' => 300.00,
                'living_room' => '1',
                'bedrooms' => '3',
                'bathrooms' => 2,
                'floor_number' => null,
                'floors_in_building' => 2,
                'building_age' => 12,
                'furniture_status' => Property::FURNITURE_UNFURNISHED,
                'within_site' => true,
                'exterior_features' => ['garden', 'terrace', 'parking'],
                'interior_features' => ['central_heating'],
                'location_features' => ['near_schools', 'near_shopping'],
                'title' => 'Family Townhouse in Salamis',
                'description' => 'Spacious 3-bedroom townhouse perfect for families. Features a private garden and is located in a quiet residential area with good amenities nearby.',
                'video_url' => null,
                'tour_360_url' => null,
                'photos' => [
                    'https://example.com/townhouse1.jpg',
                    'https://example.com/townhouse2.jpg'
                ],
                'add_ons' => ['Garden Maintenance'],
            ],
        ];

        // Get company ID for properties
        $company = Company::first();
        
        foreach ($properties as $propertyData) {
            $propertyData['company_id'] = $company->id ?? null;
            Property::create($propertyData);
        }

        $this->command->info('Properties seeded successfully!');
    }
}