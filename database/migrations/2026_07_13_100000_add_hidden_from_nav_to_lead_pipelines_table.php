<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_pipelines', function (Blueprint $table) {
            $table->boolean('hidden_from_nav')->default(false)->after('default');
        });
    }

    public function down(): void
    {
        Schema::table('lead_pipelines', function (Blueprint $table) {
            $table->dropColumn('hidden_from_nav');
        });
    }
};
