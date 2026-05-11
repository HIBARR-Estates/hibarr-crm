<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('company_expose_configurations', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->unique();

            $table->boolean('outro_enabled')->default(false);
            $table->string('outro_title')->nullable();
            $table->text('outro_description')->nullable();
            $table->string('outro_primary_image')->nullable();
            $table->string('outro_secondary_image')->nullable();

            $table->boolean('qr_enabled')->default(false);
            $table->string('qr_code_link', 2048)->nullable();

            $table->timestamps();

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('company_expose_configurations');
    }
};
