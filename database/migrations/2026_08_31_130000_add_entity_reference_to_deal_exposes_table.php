<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('deal_exposes', 'entity_type')) {
            return;
        }

        Schema::table('deal_exposes', function (Blueprint $table) {
            // Direct reference for a linked property / developer project /
            // unit type. Linking no longer mints an ExposeSnapshot (see
            // DealExposeController::store()) — it just records which
            // catalog entity was linked, so the reference lives here
            // instead of behind expose_snapshot_id.
            $table->string('entity_type', 32)->nullable()->after('expose_snapshot_id');
            $table->unsignedBigInteger('entity_id')->nullable()->after('entity_type');
            $table->unsignedBigInteger('unit_type_id')->nullable()->after('entity_id');
        });
    }

    public function down(): void
    {
        Schema::table('deal_exposes', function (Blueprint $table) {
            $table->dropColumn(['entity_type', 'entity_id', 'unit_type_id']);
        });
    }
};
