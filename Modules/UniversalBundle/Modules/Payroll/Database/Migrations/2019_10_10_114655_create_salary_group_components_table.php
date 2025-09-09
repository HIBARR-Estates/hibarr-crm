<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('salary_group_components', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('salary_group_id');
            $table->foreign('salary_group_id')->references('id')->on('salary_groups')->onDelete('cascade');

            $table->unsignedBigInteger('salary_component_id');
            $table->foreign('salary_component_id')->references('id')->on('salary_components')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('salary_group_components');
    }
};
