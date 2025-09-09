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
        Schema::create('employee_variable_salaries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('monthly_salary_id');
            $table->foreign('monthly_salary_id')->references('id')->on('employee_monthly_salaries')->onDelete('cascade');
            $table->unsignedBigInteger('variable_component_id');
            $table->foreign('variable_component_id')->references('id')->on('salary_components')->onDelete('cascade');
            $table->string('variable_value')->nullable();
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
        Schema::dropIfExists('employee_variable_commponent_salaries');
    }
};
