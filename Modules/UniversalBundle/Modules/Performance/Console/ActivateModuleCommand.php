<?php

namespace Modules\Performance\Console;

use App\Models\Company;
use App\Models\Module;
use Illuminate\Console\Command;
use Modules\Performance\Entities\PerformanceSetting;

class ActivateModuleCommand extends Command
{

    /**
     * The name and signature of the console command.
     */
    protected $signature = 'performance:activate';

    /**
     * The console command description.
     */
    protected $description = 'Add all the module settings of asset module.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        Module::firstOrCreate(['module_name' => PerformanceSetting::MODULE_NAME]);

        Company::select('id')->chunk(50, function ($companies) {

            foreach ($companies as $company) {
                PerformanceSetting::addModuleSetting($company);
            }
        });
    }
}
