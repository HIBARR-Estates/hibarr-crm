<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_signatures')) {
            return;
        }

        Schema::create('email_signatures', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedBigInteger('connection_id');
            $table->text('text_body')->nullable();
            $table->text('html_body')->nullable();
            $table->timestamps();

            $table->unique('connection_id', 'email_signatures_connection_unique');
            $table->index(['company_id', 'connection_id'], 'email_signatures_company_connection_index');

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->foreign('connection_id')
                ->references('id')
                ->on('email_connections')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_signatures');
    }
};
