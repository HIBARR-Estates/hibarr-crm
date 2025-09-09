<?php

namespace Modules\QRCode\Console;

use App\Models\Company;
use Illuminate\Console\Command;
use Modules\QRCode\Entities\QRCodeSetting;

class ActivateModuleCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $name = 'qrcode:activate';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Add all the module settings of qrcode module';

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function handle()
    {
        $companies = Company::all();

        foreach ($companies as $company) {
            QRCodeSetting::addModuleSetting($company);
        }
    }

}
