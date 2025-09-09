<?php

namespace Modules\Sms\Console;

use App\Models\Company;
use Illuminate\Console\Command;
use Modules\Sms\Entities\SmsSetting;

class ActivateModuleCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $name = 'sms:activate';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Add all the module settings of sms module';

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function handle()
    {
        $companies = Company::all();

        foreach ($companies as $company) {
            SmsSetting::addModuleSetting($company);
        }
    }
}
