<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mlm_level_criteria', function (Blueprint $table) {
            $table->string('description', 500)->nullable()->after('threshold');
        });
    }

    public function down(): void
    {
        Schema::table('mlm_level_criteria', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
};
