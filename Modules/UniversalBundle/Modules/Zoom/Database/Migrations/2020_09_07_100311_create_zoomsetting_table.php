<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Zoom\Entities\ZoomSetting;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('zoom_setting', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('api_key', 50)->nullable();
            $table->string('secret_key', 50)->nullable();
            $table->timestamps();
        });

        $setting = new ZoomSetting;
        $setting->saveQuietly();
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('zoom_setting');
    }
};
