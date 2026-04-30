 <?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_report_summaries', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable()->index();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');

            // User-provided metadata
            $table->string('title')->nullable();
            $table->text('description')->nullable();

            // The AI-generated text
            $table->longText('summary');

            // Filters that were active when the summary was generated
            $table->date('filter_start_date');
            $table->date('filter_end_date');
            $table->unsignedBigInteger('filter_agent_id')->nullable()->index();
            $table->foreign('filter_agent_id')->references('id')->on('lead_agents')->onDelete('set null');
            $table->enum('filter_view_type', ['agent', 'department'])->default('agent');

            // Human-readable label for the agent/department at save time
            $table->string('context_label');

            $table->unsignedInteger('added_by')->nullable()->index();
            $table->foreign('added_by')->references('id')->on('users')->onDelete('set null');
            $table->unsignedInteger('last_updated_by')->nullable()->index();
            $table->foreign('last_updated_by')->references('id')->on('users')->onDelete('set null');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_report_summaries');
    }
};
