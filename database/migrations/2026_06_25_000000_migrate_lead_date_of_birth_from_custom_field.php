<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Copy Date of birth custom field (ID 167) data to the date_of_birth column on leads table
        DB::statement("
            UPDATE leads
            JOIN custom_fields_data ON custom_fields_data.model_id = leads.id 
                                   AND custom_fields_data.custom_field_id = 167
                                   AND custom_fields_data.model = ?
            SET leads.date_of_birth = NULLIF(custom_fields_data.value, '')
            WHERE NULLIF(custom_fields_data.value, '') IS NOT NULL
        ", ['App\Models\Lead']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reversing this might not be strictly necessary or accurate because 
        // the original data might still exist in custom_fields_data, 
        // or we shouldn't nullify leads.date_of_birth in case it was updated independently.
        // But for completeness, we can clear it if it was migrated.
        // However, a safe 'down' is usually just to do nothing or 
        // to set leads.date_of_birth = NULL only where we know it came from the custom field.
        // We'll leave this empty to prevent accidental data loss.
    }
};
