<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Biolinks\Entities\BiolinksGlobalSetting;

return new class extends Migration {

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('biolink_blocks', function (Blueprint $table) {
            $table->string('placeholder')->nullable();
            $table->string('name_placeholder')->nullable();
            $table->string('button_text')->nullable();
            $table->string('thank_you_message')->nullable();
            $table->string('thank_you_url')->nullable();
            $table->boolean('show_agreement')->default(false)->nullable();
            $table->string('agreement_text')->nullable();
            $table->string('agreement_url')->nullable();
            $table->string('api_key')->nullable();
            $table->string('mailchimp_list')->nullable();
            $table->string('webhook_url')->nullable();
            $table->string('cancelled_payment_url')->nullable();

        });

        Company::select('id')->chunk(50, function ($companies) {

            foreach ($companies as $company) {
                BiolinksGlobalSetting::addModuleSetting($company);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('biolink_blocks', function (Blueprint $table) {
            $table->dropColumn('placeholder');
            $table->dropColumn('name_placeholder');
            $table->dropColumn('button_text');
            $table->dropColumn('thank_you_message');
            $table->dropColumn('thank_you_url');
            $table->dropColumn('show_agreement');
            $table->dropColumn('agreement_text');
            $table->dropColumn('agreement_url');
            $table->dropColumn('api_key');
            $table->dropColumn('mailchimp_list');
            $table->dropColumn('webhook_url');
            $table->dropColumn('cancelled_payment_url');
        });
    }

};
