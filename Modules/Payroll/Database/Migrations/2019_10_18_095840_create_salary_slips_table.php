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
        Schema::create('salary_slips', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->integer('user_id')->unsigned();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');

            $table->unsignedBigInteger('salary_group_id')->nullable();
            $table->foreign('salary_group_id')->references('id')->on('salary_groups')->onDelete('cascade');

            $table->string('basic_salary')->default('0');
            $table->string('net_salary')->default('0');

            $table->string('month');
            $table->string('year');
            $table->date('paid_on')->nullable();
            $table->enum('status', ['generated', 'review', 'locked', 'paid'])->default('generated');
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
        Schema::dropIfExists('salary_slips');
    }
};
