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
        Schema::dropIfExists('deal_service');
        Schema::dropIfExists('deal_property_services');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('deal_property_services', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->double('value')->default(0);
            $table->string('category');
            $table->timestamps();
        });

        Schema::create('deal_service', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id');
            $table->foreign('deal_id')->references('id')->on('deals')->onDelete('cascade')->onUpdate('cascade');
            $table->unsignedBigInteger('deal_property_service_id');
            $table->foreign('deal_property_service_id')->references('id')->on('deal_property_services')->onDelete('cascade')->onUpdate('cascade');
            $table->timestamps();
        });
    }
};
