<?php

use App\Enums\AgeRange;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('leads')) {
            return;
        }

        if (!Schema::hasColumn('leads', 'age')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->unsignedTinyInteger('age')->nullable()->after('date_of_birth');
            });
        }

        if (!Schema::hasColumn('leads', 'age_range')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->string('age_range')->nullable()->after('age');
            });
        }

        $this->backfillAgeRangeFromCustomField();
    }

    public function down(): void
    {
        if (!Schema::hasTable('leads')) {
            return;
        }

        $columns = [];

        if (Schema::hasColumn('leads', 'age_range')) {
            $columns[] = 'age_range';
        }

        if (Schema::hasColumn('leads', 'age')) {
            $columns[] = 'age';
        }

        if ($columns !== []) {
            Schema::table('leads', function (Blueprint $table) use ($columns) {
                $table->dropColumn($columns);
            });
        }
    }

    private function backfillAgeRangeFromCustomField(): void
    {
        if (
            !Schema::hasTable('custom_fields')
            || !Schema::hasTable('custom_fields_data')
            || !Schema::hasTable('custom_field_groups')
        ) {
            return;
        }

        $allowedValues = AgeRange::values();

        $fieldIds = DB::table('custom_fields')
            ->join('custom_field_groups', 'custom_fields.custom_field_group_id', '=', 'custom_field_groups.id')
            ->where('custom_field_groups.model', 'App\Models\Lead')
            ->where('custom_fields.name', 'age')
            ->pluck('custom_fields.id');

        foreach ($fieldIds as $fieldId) {
            DB::table('custom_fields_data')
                ->select('model_id', 'value')
                ->where('custom_field_id', $fieldId)
                ->where('model', 'App\Models\Lead')
                ->whereNotNull('value')
                ->where('value', '!=', '')
                ->whereIn('value', $allowedValues)
                ->orderBy('model_id')
                ->chunk(500, function ($rows) {
                    foreach ($rows as $row) {
                        DB::table('leads')
                            ->where('id', $row->model_id)
                            ->whereNull('age_range')
                            ->update(['age_range' => $row->value]);
                    }
                });
        }
    }
};
