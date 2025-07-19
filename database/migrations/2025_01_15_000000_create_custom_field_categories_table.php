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
        Schema::create('custom_field_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedInteger('custom_field_group_id')->nullable();
            $table->foreign('custom_field_group_id')->references('id')->on('custom_field_groups')->onDelete('cascade')->onUpdate('cascade');
            $table->integer('company_id')->unsigned()->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
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
        Schema::dropIfExists('custom_field_categories');
    }
}; 