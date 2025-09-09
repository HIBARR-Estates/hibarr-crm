<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{

    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (!Schema::hasTable('webhooks_requests')) {
            Schema::create('webhooks_requests', function (Blueprint $table) {
                $table->id();

                $table->integer('company_id')->unsigned()->nullable();
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');

                $table->unsignedBigInteger('webhooks_setting_id')->nullable();
                $table->foreign('webhooks_setting_id')->references('id')->on('webhooks_settings')->onDelete('cascade')->onUpdate('cascade');

                $table->string('headers_key')->nullable();
                $table->string('headers_value')->nullable();
                $table->enum('request_type', ['headers','body'])->default('headers');
                $table->string('body_key')->nullable();
                $table->string('body_value')->nullable();
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
        Schema::dropIfExists('webhooks_requests');
    }

};
