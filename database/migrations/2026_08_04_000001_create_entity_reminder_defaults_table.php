<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // May already exist if Herd ran 2026_08_03_100001_create_entity_reminder_defaults_table.
        if (Schema::hasTable('entity_reminder_defaults')) {
            return;
        }

        Schema::create('entity_reminder_defaults', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('entity_type', 64);
            $table->json('reminders');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'entity_type'], 'entity_reminder_defaults_company_type_unique');
            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entity_reminder_defaults');
    }
};
