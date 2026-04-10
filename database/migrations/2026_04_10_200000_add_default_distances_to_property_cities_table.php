<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('property_cities', function (Blueprint $table) {
            $table->json('default_distances')->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('property_cities', function (Blueprint $table) {
            $table->dropColumn('default_distances');
        });
    }
};
