<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('project_facilities') && !Schema::hasColumn('project_facilities', 'image_url')) {
            Schema::table('project_facilities', function (Blueprint $table) {
                $table->string('image_url', 2048)
                    ->nullable()
                    ->after('icon')
                    ->comment('Default facility image URL used for expose fallback');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('project_facilities') && Schema::hasColumn('project_facilities', 'image_url')) {
            Schema::table('project_facilities', function (Blueprint $table) {
                $table->dropColumn('image_url');
            });
        }
    }
};
