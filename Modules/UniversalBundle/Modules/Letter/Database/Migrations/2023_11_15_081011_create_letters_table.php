<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (!Schema::hasTable('letters')) {
            Schema::create('letters', function (Blueprint $table) {
                $table->increments('id');

                $table->integer('company_id')->unsigned();
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');

                $table->integer('user_id')->unsigned()->nullable();
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade')->onUpdate('cascade');

                $table->unsignedInteger('template_id');
                $table->foreign('template_id')->references('id')->on('letter_templates')->onUpdate('cascade')->onDelete('cascade');

                $table->integer('creator_id')->unsigned()->nullable();
                $table->foreign('creator_id')->references('id')->on('users')->onDelete('SET NULL')->onUpdate('cascade');

                $table->string('name')->nullable();
                $table->string('top');
                $table->string('right');
                $table->string('left');
                $table->string('bottom');
                $table->longText('description')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::drop('letters');
    }

};
