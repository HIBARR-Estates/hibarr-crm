<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-mapping companion values for financial assessment targets (currency,
 * frequency, certainty) that a single script answer cannot carry itself.
 * Null for every other kind of target.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('qualification_field_mappings') || Schema::hasColumn('qualification_field_mappings', 'target_options')) {
            return;
        }

        Schema::table('qualification_field_mappings', function (Blueprint $table) {
            $table->json('target_options')->nullable();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('qualification_field_mappings') && Schema::hasColumn('qualification_field_mappings', 'target_options')) {
            Schema::table('qualification_field_mappings', function (Blueprint $table) {
                $table->dropColumn('target_options');
            });
        }
    }
};
