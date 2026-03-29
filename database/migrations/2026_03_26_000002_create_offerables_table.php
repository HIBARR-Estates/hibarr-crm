<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offerables', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('offer_id');
            $table->morphs('offerable'); // offerable_id + offerable_type + index
            $table->timestamps();

            $table->foreign('offer_id')->references('id')->on('offers')->cascadeOnDelete();
            $table->unique(['offer_id', 'offerable_id', 'offerable_type'], 'offerables_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offerables');
    }
};
