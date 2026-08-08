<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_pipelines', function (Blueprint $table) {
            $table->boolean('hide_all_categories')->default(false)->after('hidden_from_nav');
        });
    }

    public function down(): void
    {
        Schema::table('lead_pipelines', function (Blueprint $table) {
            $table->dropColumn('hide_all_categories');
        });
    }
};
