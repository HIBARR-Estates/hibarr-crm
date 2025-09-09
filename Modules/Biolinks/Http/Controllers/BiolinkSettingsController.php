<?php

namespace Modules\Biolinks\Http\Controllers;

use App\Helper\Files;
use App\Helper\Reply;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Modules\Biolinks\Entities\BiolinkSetting;
use App\Http\Controllers\AccountBaseController;
use Modules\Biolinks\Entities\BiolinksGlobalSetting;
use Modules\Biolinks\Http\Requests\BiolinkSettingRequest;

class BiolinkSettingsController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'biolinks::app.biolinkSettings';
        $this->activeSettingMenu = 'settings';

        $this->middleware(function ($request, $next) {
            abort_403(!in_array(BiolinksGlobalSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(BiolinkSettingRequest $request, $id)
    {
        $parsedData = json_decode($request->meta_keywords, true);
        $values = $request->meta_keywords ? array_column($parsedData, 'value') : [];
        $keywords = json_encode($values);

        if ($request->theme == 'Custom') {
            $themeColor = 'linear-gradient(to bottom,  ' . $request->custom_color_one . ',  ' . $request->custom_color_two . ')';
        }
        else {
            $themeColor = $request->theme_color;
        }

        $biolinkSetting = BiolinkSetting::findOrFail($id);
        $biolinkSetting->theme = $request->theme;
        $biolinkSetting->theme_color = $themeColor;
        $biolinkSetting->custom_color_one = $request->custom_color_one;
        $biolinkSetting->custom_color_two = $request->custom_color_two;
        $biolinkSetting->font = $request->font;
        $biolinkSetting->block_space = $request->block_space;
        $biolinkSetting->block_hover_animation = $request->block_animation;
        $biolinkSetting->branding_text_color = $request->branding_text_color;
        $biolinkSetting->verified_badge = $request->verified_badge;
        $biolinkSetting->branding_name = $request->branding_name;
        $biolinkSetting->branding_url = $request->branding_url;
        $biolinkSetting->is_sensitive = $request->is_sensitive ? $request->is_sensitive : 'no';

        if ($request->password) {
            $biolinkSetting->protection_password = Hash::make($request->password);
        }

        $biolinkSetting->page_title = $request->page_title;
        $biolinkSetting->meta_keywords = $request->meta_keywords ? $keywords : null;
        $biolinkSetting->meta_description = $request->meta_description;
//        $biolinkSetting->custom_css = $request->custom_css;
//        $biolinkSetting->custom_js = $request->custom_js;

        if ($request->favicon_delete == 'yes') {
            Files::deleteFile($biolinkSetting->favicon, 'favicon');
            $biolinkSetting->favicon = null;
        }

        if ($request->hasFile('favicon')) {
            $biolinkSetting->favicon = Files::uploadLocalOrS3($request->favicon, 'favicon');
        }

        $biolinkSetting->save();

        return Reply::success(__('messages.recordSaved'));
    }

}
