<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Fix property_assets rows that were created via storeFromUrls
     * without a company_id. Backfill from the parent property.
     */
    public function up(): void
    {
        DB::statement('
            UPDATE property_assets
            INNER JOIN properties ON properties.id = property_assets.property_id
            SET property_assets.company_id = properties.company_id
            WHERE property_assets.company_id IS NULL
        ');
    }

    public function down(): void
    {
        // No rollback needed — we're only fixing data
    }
};
