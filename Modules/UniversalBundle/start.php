<?php

use Illuminate\Support\Facades\File;
use Modules\UniversalBundle\Entities\UniversalModuleInstall;

if (! function_exists('isInstallFromUniversalBundleModule')) {

    function isInstallFromUniversalBundleModule($name)
    {
        return UniversalModuleInstall::where('module_name', $name)->exists();
    }

}

if (! function_exists('getUniversalBundleModules')) {

    function getUniversalBundleModules()
    {
        return UniversalModuleInstall::all();
    }

}

if (! function_exists('getUniversalBundleModule')) {

    function getUniversalBundleModule($name)
    {
        return UniversalModuleInstall::where('module_name', $name)->first();
    }

}

if (! function_exists('getUniversalBundleModulesPath')) {

    function getUniversalBundleModulesPath()
    {
        return module_path('UniversalBundle', 'Modules');
    }

}

if (! function_exists('getUniversalBundleAvailableModules')) {

    function getUniversalBundleAvailableModules()
    {
        $modulesPath = getUniversalBundleModulesPath();
        $modules = [];

        if (file_exists($modulesPath)) {
            // get only directories
            $modules = File::directories($modulesPath);
            // remove path from array
            $modules = array_map(function ($module) use ($modulesPath) {
                return str_replace($modulesPath.'/', '', $module);
            }, $modules);
        }

        return $modules;
    }

}

if (! function_exists('getUniversalBundleAvailableForInstallModules')) {

    function getUniversalBundleAvailableForInstallModules()
    {
        $modules = getUniversalBundleAvailableModules();
        $installedModules = array_keys(\Nwidart\Modules\Facades\Module::all());

        $availableModules = [];

        foreach ($modules as $module) {
            if (in_array($module, $installedModules)) {
                // check version of installedModule and compare with version of bundle module
                // get version of from version.txt
                $moduleVersion = File::get(getUniversalBundleModulesPath() . '/' .$module .'/version.txt');
                $installedModuleVersion = File::get(base_path('Modules' . '/' . $module . '/version.txt'));

                if ($moduleVersion > $installedModuleVersion) {
                    $availableModules[] = $module;
                }
            }
            else {
                $availableModules[] = $module;
            }
        }

        return $availableModules;
    }

}
