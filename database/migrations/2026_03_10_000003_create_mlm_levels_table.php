<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mlm_levels', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('slug');
            $table->unsignedInteger('rank')->default(0);
            $table->unsignedDecimal('commission_percentage', 5, 2)->default(0);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->unique(['company_id', 'slug']);
            $table->index('rank');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mlm_levels');
    }
};
