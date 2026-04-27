<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            if (!Schema::hasColumn('deals', 'manual_value')) {
                $table->decimal('manual_value', 20, 2)->nullable()->after('value');
            }

            if (!Schema::hasColumn('deals', 'calculated_value')) {
                $table->decimal('calculated_value', 20, 2)->nullable()->after('manual_value');
            }

            if (!Schema::hasColumn('deals', 'value_source')) {
                $table->string('value_source', 20)->default('manual')->after('calculated_value');
            }
        });

        DB::table('deals')->whereNull('manual_value')->update([
            'manual_value' => DB::raw('COALESCE(value, 0)'),
        ]);

        DB::table('deals')->whereNull('calculated_value')->update([
            'calculated_value' => DB::raw('COALESCE(value, 0)'),
        ]);

        DB::table('deals')
            ->whereNull('value_source')
            ->orWhere('value_source', '')
            ->update(['value_source' => 'manual']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('deals', function (Blueprint $table) {
            if (Schema::hasColumn('deals', 'value_source')) {
                $table->dropColumn('value_source');
            }

            if (Schema::hasColumn('deals', 'calculated_value')) {
                $table->dropColumn('calculated_value');
            }

            if (Schema::hasColumn('deals', 'manual_value')) {
                $table->dropColumn('manual_value');
            }
        });
    }
};
