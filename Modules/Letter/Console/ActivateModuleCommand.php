<?php

namespace Modules\Letter\Console;

use App\Models\Company;
use Illuminate\Console\Command;
use Modules\Letter\Entities\LetterSetting;

class ActivateModuleCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $name = 'letter:activate';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Add all the module settings of letter module';

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function handle()
    {
        $companies = Company::all();

        foreach ($companies as $company) {
            LetterSetting::addModuleSetting($company);
        }
    }

}
