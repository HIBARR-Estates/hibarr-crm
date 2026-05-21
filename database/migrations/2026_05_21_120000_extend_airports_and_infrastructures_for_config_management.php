<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('airports', function (Blueprint $table) {
            if (!Schema::hasColumn('airports', 'company_id')) {
                $table->unsignedInteger('company_id')->nullable()->after('id');
                $table->foreign('company_id')->references('id')->on('companies')->nullOnDelete();
                $table->index('company_id');
            }

            if (!Schema::hasColumn('airports', 'label')) {
                $table->string('label')->nullable()->after('name');
            }

            if (!Schema::hasColumn('airports', 'description')) {
                $table->text('description')->nullable()->after('label');
            }

            if (!Schema::hasColumn('airports', 'image_url')) {
                $table->string('image_url', 2048)->nullable()->after('description');
            }
        });

        Schema::table('infrastructures', function (Blueprint $table) {
            if (!Schema::hasColumn('infrastructures', 'label')) {
                $table->string('label')->nullable()->after('name');
            }

            if (!Schema::hasColumn('infrastructures', 'description')) {
                $table->text('description')->nullable()->after('label');
            }

            if (!Schema::hasColumn('infrastructures', 'image_url')) {
                $table->string('image_url', 2048)->nullable()->after('description');
            }
        });

        DB::table('airports')
            ->whereNull('label')
            ->update(['label' => DB::raw('name')]);

        DB::table('infrastructures')
            ->whereNull('label')
            ->update(['label' => DB::raw('name')]);
    }

    public function down(): void
    {
        Schema::table('airports', function (Blueprint $table) {
            if (Schema::hasColumn('airports', 'company_id')) {
                $table->dropForeign(['company_id']);
                $table->dropIndex(['company_id']);
                $table->dropColumn('company_id');
            }

            if (Schema::hasColumn('airports', 'image_url')) {
                $table->dropColumn('image_url');
            }

            if (Schema::hasColumn('airports', 'description')) {
                $table->dropColumn('description');
            }

            if (Schema::hasColumn('airports', 'label')) {
                $table->dropColumn('label');
            }
        });

        Schema::table('infrastructures', function (Blueprint $table) {
            if (Schema::hasColumn('infrastructures', 'image_url')) {
                $table->dropColumn('image_url');
            }

            if (Schema::hasColumn('infrastructures', 'description')) {
                $table->dropColumn('description');
            }

            if (Schema::hasColumn('infrastructures', 'label')) {
                $table->dropColumn('label');
            }
        });
    }
};
