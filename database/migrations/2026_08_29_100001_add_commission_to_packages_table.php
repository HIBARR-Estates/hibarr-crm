<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            if (! Schema::hasColumn('packages', 'commission_type')) {
                // Nullable on purpose: a package with no commission configured
                // keeps the level-based MLM distribution, so this ships inert.
                $table->string('commission_type', 12)->nullable()->after('currency');
            }
            if (! Schema::hasColumn('packages', 'commission_value')) {
                $table->decimal('commission_value', 15, 2)->nullable()->after('commission_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('packages', function (Blueprint $table) {
            foreach (['commission_value', 'commission_type'] as $column) {
                if (Schema::hasColumn('packages', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
