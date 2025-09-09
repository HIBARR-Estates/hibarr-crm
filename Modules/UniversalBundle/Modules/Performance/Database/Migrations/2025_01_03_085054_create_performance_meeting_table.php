<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Performance\Entities\PerformanceSetting;

return new class extends Migration
{

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('performance_meetings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete()->cascadeOnUpdate();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->foreign('parent_id')->references('id')->on('performance_meetings')->onDelete('cascade');
            $table->foreignId('objective_id')->nullable()->constrained('objectives')->onDelete('cascade');
            $table->datetime('start_date_time');
            $table->datetime('end_date_time');
            $table->enum('repeat', ['yes', 'no'])->default('no');
            $table->enum('repeat_every', ['day', 'week', 'month', 'year'])->nullable();
            $table->integer('repeat_cycles')->nullable();
            $table->enum('repeat_type', ['after', 'on'])->nullable();
            $table->date('until_date')->nullable();
            $table->unsignedInteger('meeting_for');
            $table->foreign(['meeting_for'])->references(['id'])->on('users')->onUpdate('CASCADE')->onDelete('CASCADE');
            $table->unsignedInteger('meeting_by');
            $table->foreign(['meeting_by'])->references(['id'])->on('users')->onUpdate('CASCADE')->onDelete('CASCADE');
            $table->unsignedInteger('added_by');
            $table->foreign(['added_by'])->references(['id'])->on('users')->onUpdate('CASCADE')->onDelete('CASCADE');
            $table->enum('status', ['pending', 'completed', 'cancelled'])->default('pending');
            $table->timestamps();
        });

        Schema::create('performance_meeting_agenda', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('meeting_id');
            $table->foreign('meeting_id')->references('id')->on('performance_meetings')->onDelete('cascade');
            $table->text('discussion_point');
            $table->unsignedInteger('added_by');
            $table->foreign(['added_by'])->references(['id'])->on('users')->onUpdate('CASCADE')->onDelete('CASCADE');
            $table->enum('is_discussed', ['yes', 'no'])->default('no');
            $table->timestamps();
        });

        Schema::create('performance_meeting_actions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('meeting_id');
            $table->foreign('meeting_id')->references('id')->on('performance_meetings')->onDelete('cascade');
            $table->text('action_point');
            $table->unsignedInteger('added_by');
            $table->foreign(['added_by'])->references(['id'])->on('users')->onUpdate('CASCADE')->onDelete('CASCADE');
            $table->enum('is_actioned', ['yes', 'no'])->default('no');
            $table->timestamps();
        });

        $meetingSeetings = PerformanceSetting::all();

        foreach ($meetingSeetings as $meetingSeeting) {
            $meetingSeeting->create_meeting_manager = 1;
            $meetingSeeting->view_meeting_participant = 1;
            $meetingSeeting->save();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('performance_meeting_actions');
        Schema::dropIfExists('performance_meeting_agenda');
        Schema::dropIfExists('performance_meetings');
    }

};
