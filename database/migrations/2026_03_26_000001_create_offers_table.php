<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('type', 20); // percentage | fixed
            $table->unsignedDecimal('value', 15, 2);
            $table->unsignedDecimal('max_discount_amount', 15, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->date('starts_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('added_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('last_updated_by')->references('id')->on('users')->nullOnDelete();

            $table->index(['company_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offers');
    }
};
