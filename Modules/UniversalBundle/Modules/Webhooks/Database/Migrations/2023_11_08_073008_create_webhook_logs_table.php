<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Webhooks\Entities\WebhooksGlobalSetting;

return new class extends Migration {

    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {

        if (!Schema::hasTable('webhooks_logs')) {
            Schema::create('webhooks_logs', function (Blueprint $table) {
                $table->id();

                $table->unsignedBigInteger('webhooks_setting_id');
                $table->foreign('webhooks_setting_id')->references('id')->on('webhooks_settings')->onDelete('cascade')->onUpdate('cascade');

                $table->string('method')->nullable();
                $table->string('action')->nullable();
                $table->string('webhook_for')->nullable();

                $table->text('raw_content')->nullable();
                $table->text('headers')->nullable();
                $table->text('response')->nullable();
                $table->integer('response_code')->nullable()->default(200);

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
        Schema::dropIfExists('webhooks_logs');
    }

};
