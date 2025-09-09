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

        if (!Schema::hasTable('webhooks_settings')) {
            Schema::create('webhooks_settings', function (Blueprint $table) {
                $table->id();

                $table->integer('company_id')->unsigned()->nullable();
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');

                $table->string('name');
                $table->string('webhook_for');
                $table->boolean('action')->nullable();
                $table->string('url')->nullable();
                $table->string('request_method')->nullable();
                $table->string('request_format')->nullable();
                $table->enum('status', ['active','inactive'])->default('active');
                $table->boolean('run_debug')->default(0);
                $table->timestamps();
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
        Schema::dropIfExists('webhooks_settings');
    }

};
