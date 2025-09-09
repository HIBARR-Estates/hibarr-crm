<?php

namespace Modules\Biolinks\Console;

use App\Models\Company;
use Illuminate\Console\Command;
use Modules\Biolinks\Entities\BiolinksGlobalSetting;

class ActivateModuleCommand extends Command
{

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $name = 'biolinks:activate';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Add all the module settings of biolinks module';

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function handle()
    {
        $companies = Company::select('id')->get();

        foreach ($companies as $company) {

            BiolinksGlobalSetting::addModuleSetting($company);
        }
    }

}
