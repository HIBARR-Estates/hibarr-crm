<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (
            !Schema::hasTable('leads')
            || !Schema::hasTable('custom_fields')
            || !Schema::hasTable('custom_fields_data')
            || !Schema::hasTable('custom_field_groups')
        ) {
            return;
        }

        $fieldIds = DB::table('custom_fields')
            ->join(
                'custom_field_groups',
                'custom_fields.custom_field_group_id',
                '=',
                'custom_field_groups.id',
            )
            ->where('custom_field_groups.model', 'App\Models\Lead')
            ->where('custom_fields.name', 'Date of birth')
            ->pluck('custom_fields.id');

        foreach ($fieldIds as $fieldId) {
            DB::statement('
                UPDATE leads
                JOIN custom_fields_data ON custom_fields_data.model_id = leads.id
                                       AND custom_fields_data.custom_field_id = ?
                                       AND custom_fields_data.model = ?
                SET leads.date_of_birth = NULLIF(custom_fields_data.value, \'\')
                WHERE NULLIF(custom_fields_data.value, \'\') IS NOT NULL
            ', [$fieldId, 'App\Models\Lead']);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reversing this might not be strictly necessary or accurate because
        // the original data might still exist in custom_fields_data,
        // or we shouldn't nullify leads.date_of_birth in case it was updated independently.
    }
};
