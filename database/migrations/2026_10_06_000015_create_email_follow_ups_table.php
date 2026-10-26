<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_follow_ups')) {
            return;
        }

        Schema::create('email_follow_ups', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('message_id');
            // task | deal_note | lead_note | meeting
            $table->string('followable_type', 32);
            $table->unsignedBigInteger('followable_id');
            $table->unsignedInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(
                ['followable_type', 'followable_id'],
                'email_follow_ups_followable_unique',
            );
            $table->index(['company_id', 'message_id'], 'email_follow_ups_company_message_index');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreign('message_id')
                ->references('id')
                ->on('email_messages')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_follow_ups');
    }
};
