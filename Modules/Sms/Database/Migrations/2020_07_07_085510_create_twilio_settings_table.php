<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Sms\Entities\SmsSetting;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        \App\Models\Module::validateVersion(SmsSetting::MODULE_NAME);

        Schema::create('sms_settings', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->string('account_sid')->nullable();
            $table->string('auth_token')->nullable();
            $table->string('from_number')->nullable();
            $table->boolean('status');
            $table->string('whatapp_from_number')->nullable();
            $table->boolean('whatsapp_status');

            $table->string('nexmo_api_key')->nullable();
            $table->string('nexmo_api_secret')->nullable();
            $table->string('nexmo_from_number')->nullable();
            $table->boolean('nexmo_status');

            $table->string('msg91_auth_key')->nullable();
            $table->string('msg91_from')->nullable();
            $table->boolean('msg91_status');

            $table->string('purchase_code')->nullable();
            $table->timestamp('supported_until')->nullable();
            $table->timestamps();
        });

        SmsSetting::create([]);

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('sms_settings');
    }
};
