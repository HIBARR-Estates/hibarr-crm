<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Validation in DealExposeController::store() already accepts values
        // wider than the original VARCHAR(255) columns (object_path up to
        // 512 chars, and download_url — written into external_url — had no
        // max at all) — a validated value could exceed the column and fail
        // to save. Widen both to match.
        Schema::table('deal_exposes', function (Blueprint $table) {
            $table->string('external_url', 2048)->nullable()->change();
            $table->string('object_path', 512)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('deal_exposes', function (Blueprint $table) {
            $table->string('external_url', 255)->nullable()->change();
            $table->string('object_path', 255)->nullable()->change();
        });
    }
};
