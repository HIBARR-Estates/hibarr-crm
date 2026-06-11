<?php

use App\Models\Company;
use App\Models\LeadLifecycleStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        if (Schema::hasTable('lead_lifecycle_statuses')) {
            return;
        }

        Schema::create('lead_lifecycle_statuses', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->string('key', 50);
            $table->string('label');
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('label_color', 20)->nullable();
            $table->timestamps();

            $table->foreign('company_id', 'lead_lifecycle_statuses_company_id_foreign')
                ->references('id')
                ->on('companies')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            $table->unique(['company_id', 'key'], 'lead_lifecycle_statuses_company_key_unique');
            $table->index('company_id');
        });

        $this->seedDefaultStatuses();
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_lifecycle_statuses');
    }

    private function seedDefaultStatuses(): void
    {
        if (!Schema::hasTable('companies')) {
            return;
        }

        foreach (Company::all() as $company) {
            LeadLifecycleStatus::seedDefaultsForCompany($company->id);
        }
    }
};
