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
        \App\Models\Module::validateVersion(ZoomSetting::MODULE_NAME);

        Schema::create('zoom_meetings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('meeting_id', 50)->nullable();
            $table->unsignedInteger('created_by');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade')->onUpdate('cascade');
            $table->string('meeting_name', 100);
            $table->string('label_color', 20);
            $table->mediumText('description')->nullable();
            $table->dateTime('start_date_time');
            $table->dateTime('end_date_time');
            $table->boolean('repeat')->default(0);
            $table->integer('repeat_every')->nullable();
            $table->integer('repeat_cycles')->nullable();
            $table->enum('repeat_type', ['day', 'week', 'month', 'year']);
            $table->boolean('send_reminder')->default(0);
            $table->integer('remind_time')->nullable();
            $table->enum('remind_type', ['day', 'hour', 'minute']);
            $table->boolean('host_video')->default(0);
            $table->boolean('participant_video')->default(0);
            $table->string('start_link')->nullable();
            $table->string('join_link')->nullable();
            $table->enum('status', ['waiting', 'live', 'canceled', 'finished'])->default('waiting');
            $table->integer('project_id')->unsigned()->nullable();
            $table->foreign('project_id')->references('id')->on('projects')->onDelete('cascade')->onUpdate('cascade');
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
        Schema::dropIfExists('zoom_meetings');
    }
};
