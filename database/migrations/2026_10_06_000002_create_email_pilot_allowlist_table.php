<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_pilot_allowlist')) {
            return;
        }

        Schema::create('email_pilot_allowlist', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            // Null = every user of the company is in the pilot.
            $table->unsignedInteger('user_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'user_id'], 'email_pilot_allowlist_company_user_unique');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreign('added_by')
                ->references('id')
                ->on('users')
                ->onDelete('set null')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_pilot_allowlist');
    }
};
