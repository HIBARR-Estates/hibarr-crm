<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Set display_order for existing custom fields based on their ID
        // This preserves the original order (by ID) for existing fields
        // New fields will use the display_order value set when created
        if (Schema::hasTable('custom_fields') && Schema::hasColumn('custom_fields', 'display_order')) {
            DB::statement('
                UPDATE custom_fields 
                SET display_order = id 
                WHERE display_order = 0 OR display_order IS NULL
            ');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reset display_order to 0 for all fields
        // Note: This will lose the ordering, but it's the best we can do in a rollback
        if (Schema::hasTable('custom_fields') && Schema::hasColumn('custom_fields', 'display_order')) {
            DB::table('custom_fields')->update(['display_order' => 0]);
        }
    }
};

