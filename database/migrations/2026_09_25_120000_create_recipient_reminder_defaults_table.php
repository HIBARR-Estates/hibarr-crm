<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('recipient_reminder_defaults')) {
            return;
        }

        Schema::create('recipient_reminder_defaults', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('entity_type', 64);
            $table->string('recipient_type', 32);
            $table->json('reminders');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(
                ['company_id', 'entity_type', 'recipient_type'],
                'recipient_reminder_defaults_company_entity_recipient_unique'
            );
            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipient_reminder_defaults');
    }
};
