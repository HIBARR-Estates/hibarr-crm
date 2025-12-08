<?php

namespace Database\Seeders;

use App\Models\Property;
use App\Models\Product;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PropertyProductSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Starting PropertyProductSeeder...');
        
        // Use database transaction for safety
        DB::transaction(function () {
            $this->createProductsForPropertiesWithoutProducts();
            $this->updatePropertiesWithoutProducts();
        });
        
        $this->command->info('PropertyProductSeeder completed successfully!');
    }

    /**
     * Create products for all properties without a product_id in bulk
     */
    private function createProductsForPropertiesWithoutProducts(): void
    {
        $this->command->info('Creating products for properties without products...');
        
        // Get properties without products in chunks for memory efficiency
        $propertiesWithoutProducts = Property::whereNull('product_id')
            ->orWhereDoesntHave('product')
            ->get(['id', 'title', 'price', 'description', 'status', 'company_id']);

        if ($propertiesWithoutProducts->isEmpty()) {
            $this->command->info('No properties found without products.');
            return;
        }

        $this->command->info("Found {$propertiesWithoutProducts->count()} properties without products.");
        
        $productsToInsert = [];
        $now = now();
        
        foreach ($propertiesWithoutProducts as $property) {
            // Get the first user with the same company_id for added_by
            $addedBy = DB::table('users')
                ->where('company_id', $property->company_id)
                ->where('status', 'active')
                ->first()?->id ?? 1; // Fallback to ID 1 if no user found

            $productsToInsert[] = [
                'name' => $property->title ?? "Property #{$property->id}",
                'price' => $property->price ?? 0,
                'description' => $property->description ?? "Property listing for {$property->title}",
                'allow_purchase' => $property->status === Property::STATUS_AVAILABLE ? 1 : 0,
                'company_id' => $property->company_id,
                'added_by' => $addedBy,
                'unit_id' => 1, // Default unit ID as per PropertyController
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // Bulk insert products for better performance
        $chunks = array_chunk($productsToInsert, 500); // Process in chunks of 500
        $totalInserted = 0;

        foreach ($chunks as $chunk) {
            DB::table('products')->insert($chunk);
            $totalInserted += count($chunk);
            $this->command->info("Inserted {$totalInserted}/{$propertiesWithoutProducts->count()} products...");
        }

        $this->command->info("Successfully created {$totalInserted} products.");
    }

    /**
     * Update properties to link them with their newly created products
     */
    private function updatePropertiesWithoutProducts(): void
    {
        $this->command->info('Linking properties with their products...');
        
        // Get properties that still don't have product_id set
        $propertiesWithoutProductId = Property::whereNull('product_id')
            ->get(['id', 'title', 'company_id']);

        if ($propertiesWithoutProductId->isEmpty()) {
            $this->command->info('All properties already have products assigned.');
            return;
        }

        $updatedCount = 0;

        foreach ($propertiesWithoutProductId as $property) {
            // Find the corresponding product by matching name and company_id
            $product = Product::where('name', $property->title ?? "Property #{$property->id}")
                ->where('company_id', $property->company_id)
                ->whereDoesntHave('property') // Ensure product isn't already linked
                ->first();

            if ($product) {
                // Update property with product_id
                Property::where('id', $property->id)
                    ->update(['product_id' => $product->id]);
                $updatedCount++;

                if ($updatedCount % 100 === 0) {
                    $this->command->info("Updated {$updatedCount} properties...");
                }
            } else {
                // If no matching product found, create one specifically for this property
                $addedBy = DB::table('users')
                    ->where('company_id', $property->company_id)
                    ->where('status', 'active')
                    ->first()?->id ?? 1;

                $newProduct = Product::create([
                    'name' => $property->title ?? "Property #{$property->id}",
                    'price' => 0, // Default price, will be synced from property if needed
                    'description' => "Property listing for " . ($property->title ?? "Property #{$property->id}"),
                    'allow_purchase' => 1,
                    'company_id' => $property->company_id,
                    'added_by' => $addedBy,
                    'unit_id' => 1,
                ]);

                Property::where('id', $property->id)
                    ->update(['product_id' => $newProduct->id]);
                $updatedCount++;

                Log::info("Created new product {$newProduct->id} for property {$property->id}");
            }
        }

        $this->command->info("Successfully updated {$updatedCount} properties with product associations.");
    }
}
