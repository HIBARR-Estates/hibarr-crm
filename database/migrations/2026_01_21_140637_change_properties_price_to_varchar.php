<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Models\Property;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // First, change the column type from decimal to varchar
        // (so we don't risk writing JSON into a decimal column if conversion runs first)
        Schema::table('properties', function (Blueprint $table) {
            $table->string('price', 255)->nullable()->change();
        });

        // Then, convert existing decimal prices to JSON format
        // Get default currency code from company settings
        $defaultCurrencyCode = 'TRY'; // Default fallback
        
        try {
            if (function_exists('company')) {
                $company = company();
                if ($company && $company->currency) {
                    $defaultCurrencyCode = $company->currency->currency_code ?? 'TRY';
                }
            }
        } catch (\Exception $e) {
            // Use default if company() fails
        }

        // Convert all existing prices to JSON format
        DB::table('properties')
            ->whereNotNull('price')
            ->chunkById(100, function ($properties) use ($defaultCurrencyCode) {
                foreach ($properties as $property) {
                    $priceValue = $property->price;
                    
                    // Skip if already null or empty
                    if ($priceValue === null || $priceValue === '') {
                        continue;
                    }
                    
                    // If it's already a valid JSON string with expected structure, skip
                    if (is_string($priceValue)) {
                        $trimmed = trim($priceValue);
                        if (strpos($trimmed, '{') === 0 || strpos($trimmed, '[') === 0) {
                            $decoded = json_decode($priceValue, true);
                            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                                if (isset($decoded['amount']) && isset($decoded['currency'])) {
                                    continue;
                                }
                            }
                        }
                    }
                    
                    // Convert decimal/numeric to JSON format
                    $amount = is_numeric($priceValue) ? (float) $priceValue : 0;
                    $priceData = [
                        'amount' => $amount,
                        'currency' => $defaultCurrencyCode
                    ];
                    
                    DB::table('properties')
                        ->where('id', $property->id)
                        ->update(['price' => json_encode($priceData)]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // First, change the column type back to decimal
        Schema::table('properties', function (Blueprint $table) {
            $table->decimal('price', 15, 2)->nullable()->change();
        });

        // Then, convert JSON prices back to decimal (extract amount)
        DB::table('properties')
            ->whereNotNull('price')
            ->chunkById(100, function ($properties) {
                foreach ($properties as $property) {
                    $priceValue = $property->price;
                    
                    if ($priceValue === null || $priceValue === '') {
                        continue;
                    }
                    
                    // Try to parse as JSON
                    $decoded = json_decode($priceValue, true);
                    if (is_array($decoded) && isset($decoded['amount'])) {
                        $amount = (float) $decoded['amount'];
                    } elseif (is_numeric($priceValue)) {
                        $amount = (float) $priceValue;
                    } else {
                        $amount = 0;
                    }
                    
                    DB::table('properties')
                        ->where('id', $property->id)
                        ->update(['price' => $amount]);
                }
            });
    }
};
