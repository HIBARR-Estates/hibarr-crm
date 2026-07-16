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
        Schema::table('lead_setting', function (Blueprint $table) {
            $table->boolean('restrict_package_or_property')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lead_setting', function (Blueprint $table) {
            $table->dropColumn('restrict_package_or_property');
        });
    }

};
