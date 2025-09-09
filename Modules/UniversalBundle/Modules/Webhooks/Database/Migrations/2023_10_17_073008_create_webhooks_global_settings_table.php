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
        \App\Models\Module::validateVersion(WebhooksGlobalSetting::MODULE_NAME);

        if (!Schema::hasTable('webhooks_global_settings')) {
            Schema::create('webhooks_global_settings', function (Blueprint $table) {
                $table->id();
                $table->string('purchase_code')->nullable();
                $table->timestamp('supported_until')->nullable();
                $table->boolean('notify_update')->default(1);
                $table->timestamps();
            });

            WebhooksGlobalSetting::create();
        }

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('webhook_global_settings');
    }

};
