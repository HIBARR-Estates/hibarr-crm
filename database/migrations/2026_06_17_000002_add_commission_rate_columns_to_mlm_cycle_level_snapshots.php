<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mlm_cycle_level_snapshots', function (Blueprint $table) {
            $table->unsignedDecimal('direct_rate', 5, 2)->default(0)->after('commission_percentage');
            $table->unsignedDecimal('override_rate', 5, 2)->default(0)->after('direct_rate');
            $table->boolean('is_hidden')->default(false)->after('override_rate');
        });

        DB::table('mlm_cycle_level_snapshots')->update([
            'direct_rate' => DB::raw('commission_percentage'),
            'override_rate' => DB::raw('commission_percentage'),
            'is_hidden' => false,
        ]);
    }

    public function down(): void
    {
        Schema::table('mlm_cycle_level_snapshots', function (Blueprint $table) {
            $table->dropColumn(['direct_rate', 'override_rate', 'is_hidden']);
        });
    }
};
