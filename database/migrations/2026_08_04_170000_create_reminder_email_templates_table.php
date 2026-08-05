<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Per-company Plunk template IDs for entity reminder emails (editable on the fly).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('reminder_email_templates')) {
            return;
        }

        Schema::create('reminder_email_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('entity_type', 64);
            $table->string('plunk_template_id', 128)->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'entity_type'], 'reminder_email_templates_company_type_unique');
            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
        });

        // Seed known meeting Plunk template for existing companies (was previously env-only).
        $meetingPlunkId = '24330e3e-a357-41d2-8762-7014732d5b7e';
        $now = now();

        if (Schema::hasTable('companies')) {
            $companyIds = DB::table('companies')->pluck('id');
            $rows = [];
            foreach ($companyIds as $companyId) {
                $rows[] = [
                    'company_id' => (int) $companyId,
                    'entity_type' => 'meeting',
                    'plunk_template_id' => $meetingPlunkId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            foreach (array_chunk($rows, 200) as $chunk) {
                DB::table('reminder_email_templates')->insert($chunk);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('reminder_email_templates');
    }
};
