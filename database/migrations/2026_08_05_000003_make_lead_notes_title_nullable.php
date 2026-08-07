<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Align lead note titles with deal notes: optional title field.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_notes', function (Blueprint $table) {
            $table->string('title', 191)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('lead_notes', function (Blueprint $table) {
            $table->string('title', 191)->nullable(false)->change();
        });
    }
};
