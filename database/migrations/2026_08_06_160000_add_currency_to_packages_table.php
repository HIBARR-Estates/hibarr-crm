<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('packages', 'currency')) {
            Schema::table('packages', function (Blueprint $table) {
                $table->string('currency', 3)->default('EUR')->after('value');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('packages', 'currency')) {
            Schema::table('packages', function (Blueprint $table) {
                $table->dropColumn('currency');
            });
        }
    }
};
