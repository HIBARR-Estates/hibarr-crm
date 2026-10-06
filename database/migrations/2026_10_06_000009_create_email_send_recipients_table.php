<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_send_recipients')) {
            return;
        }

        Schema::create('email_send_recipients', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('send_attempt_id');
            $table->string('address');
            $table->string('name')->nullable();
            // to | cc
            $table->string('kind', 8);
            // pending | accepted | delayed | bounced | blocked_until_review — there is no "delivered".
            $table->string('status', 32)->default('pending');
            $table->timestamps();

            $table->unique(['send_attempt_id', 'address'], 'email_send_recipients_attempt_address_unique');
            $table->index(['company_id', 'address'], 'email_send_recipients_company_address_index');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreign('send_attempt_id')
                ->references('id')
                ->on('email_send_attempts')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_send_recipients');
    }
};
