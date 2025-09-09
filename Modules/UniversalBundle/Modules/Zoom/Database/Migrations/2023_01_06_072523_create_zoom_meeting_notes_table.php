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
        Schema::create(
            'zoom_meeting_notes', function (Blueprint $table) {
                $table->id();
                $table->integer('company_id')->unsigned()->nullable();
                $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');

                $table->unsignedBigInteger('zoom_meeting_id');
                $table->foreign('zoom_meeting_id')->references('id')->on('zoom_meetings')->onDelete('cascade')->onUpdate('cascade');

                $table->integer('user_id')->unsigned();
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade')->onUpdate('cascade');

                $table->text('note');

                $table->unsignedInteger('added_by')->nullable()->index('zoom_meeting_added_by_foreign');
                $table->foreign(['added_by'])->references(['id'])->on('users')->onUpdate('CASCADE')->onDelete('SET NULL');

                $table->unsignedInteger('last_updated_by')->nullable()->index('zoom_meeting_last_updated_by_foreign');
                $table->foreign(['last_updated_by'])->references(['id'])->on('users')->onUpdate('CASCADE')->onDelete('SET NULL');

                $table->timestamps();
            }
        );
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('zoom_meeting_notes');
    }
};
