<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('dynamic_translations')) {
            Schema::create('dynamic_translations', function (Blueprint $table) {
                $table->id();
                $table->string('hash_key', 64)->unique();
                $table->text('source_text');
                $table->text('en')->nullable();
                $table->text('de')->nullable();
                $table->text('ru')->nullable();
                $table->text('tr')->nullable();
                $table->string('status', 20)->default('pending');
                $table->timestamps();

                $table->index('hash_key', 'idx_dynamic_translations_hash_key');
                $table->index('status', 'idx_dynamic_translations_status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('dynamic_translations')) {
            Schema::dropIfExists('dynamic_translations');
        }
    }
};
