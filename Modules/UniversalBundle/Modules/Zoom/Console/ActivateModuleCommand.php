<?php

namespace Modules\Zoom\Console;

use App\Models\Company;
use Illuminate\Console\Command;
use Modules\Zoom\Entities\ZoomSetting;

class ActivateModuleCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $name = 'zoom:activate';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Add all the module settings of zoom module';

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function handle()
    {
        $companies = Company::all();

        foreach ($companies as $company) {
            ZoomSetting::addModuleSetting($company);
        }
    }
}
