<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mlm_level_criteria', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('mlm_level_id');
            $table->unsignedInteger('logic_group')->default(1);
            $table->string('metric', 20); // nsa, nsd, vsa, vsd, nsa_nsd, vsa_vsd
            $table->string('operator', 5)->default('>='); // >=, >, <=, <, =
            $table->unsignedDecimal('threshold', 15, 2)->default(0);
            $table->timestamps();

            $table->foreign('mlm_level_id')->references('id')->on('mlm_levels')->onDelete('cascade');
            $table->index(['mlm_level_id', 'logic_group']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mlm_level_criteria');
    }
};
