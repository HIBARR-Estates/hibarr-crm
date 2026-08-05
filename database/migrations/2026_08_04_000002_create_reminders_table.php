<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // May already exist if Herd ran 2026_08_03_100002_create_reminders_table.
        if (Schema::hasTable('reminders')) {
            return;
        }

        Schema::create('reminders', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('entity_type', 64);
            $table->unsignedInteger('entity_id');
            $table->dateTime('remind_at');
            $table->string('status', 32)->default('pending');
            $table->dateTime('sent_at')->nullable();
            $table->text('last_error')->nullable();
            $table->string('channel', 32)->default('email');
            $table->string('recipient_type', 32);
            $table->unsignedInteger('recipient_id')->nullable();
            $table->string('recipient_email')->nullable();
            $table->text('message')->nullable();
            $table->unsignedInteger('created_by')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();

            $table->index(['status', 'remind_at'], 'reminders_status_remind_at_index');
            $table->index(['company_id', 'status', 'remind_at'], 'reminders_company_status_remind_at_index');
            $table->index(['entity_type', 'entity_id', 'status'], 'reminders_entity_status_index');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reminders');
    }
};
