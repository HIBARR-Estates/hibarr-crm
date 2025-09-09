<?php

namespace Modules\Biolinks\Http\Controllers;

use App\Helper\Files;
use App\Helper\Reply;
use Illuminate\Http\Request;
use Modules\Biolinks\Entities\BiolinkBlocks;
use App\Http\Controllers\AccountBaseController;
use Modules\Biolinks\Entities\BiolinksGlobalSetting;
use Modules\Biolinks\Http\Requests\StoreBiolinkBlocks;
use Modules\Biolinks\Http\Requests\UpdateBiolinkBlocks;

class BiolinkBlocksController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'biolinks::app.biolinkSettings';

        $this->middleware(function ($request, $next) {
            abort_403(!in_array(BiolinksGlobalSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create($id)
    {
        $this->view = 'biolinks::biolink-blocks.create';
        $this->pageTitle = __('biolinks::app.menu.blocks');
        $this->id = $id;

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('biolinks::biolinks.create', $this->data);
    }

    public function createBlock($biolinkId, $blockId = null)
    {
        $this->biolinkId = $biolinkId;
        $this->block = $blockId;

        switch ($this->block) {
        case 'link':
            $this->view = 'biolinks::biolink-blocks.ajax.link-block';
            break;
        case 'heading':
            $this->view = 'biolinks::biolink-blocks.ajax.heading-block';
            break;
        case 'paragraph':
            $this->view = 'biolinks::biolink-blocks.ajax.paragraph-block';
            break;
        case 'avatar':
            $this->view = 'biolinks::biolink-blocks.ajax.avatar-block';
            break;
        case 'image':
            $this->view = 'biolinks::biolink-blocks.ajax.image-block';
            break;
        case 'socials':
            $this->view = 'biolinks::biolink-blocks.ajax.socials-block';
            break;
        case 'email-collector':
            $this->view = 'biolinks::biolink-blocks.ajax.email-collector-block';
            break;
        case 'phone-collector':
            $this->view = 'biolinks::biolink-blocks.ajax.phone-collector-block';
            break;
        case 'paypal':
            $this->view = 'biolinks::biolink-blocks.ajax.paypal-block';
            break;
        case 'sound-cloud':
            $this->view = 'biolinks::biolink-blocks.ajax.sound-cloud-block';
            break;
        case 'spotify':
            $this->view = 'biolinks::biolink-blocks.ajax.spotify-block';
            break;
        case 'youtube':
            $this->view = 'biolinks::biolink-blocks.ajax.youtube-block';
            break;
        case 'threads':
            $this->view = 'biolinks::biolink-blocks.ajax.threads-block';
            break;
        case 'tiktok':
            $this->view = 'biolinks::biolink-blocks.ajax.tiktok-block';
            break;
        case 'twitch':
            $this->view = 'biolinks::biolink-blocks.ajax.twitch-block';
            break;
        default:
            $this->view = 'biolinks::biolink-blocks.ajax.link-block';
            break;
        }

        return view($this->view, $this->data);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreBiolinkBlocks $request)
    {
        $block = BiolinkBlocks::create($request->all());

        $typeNames = [
            'avatar' => __('biolinks::app.avatar'),
            'image' => __('biolinks::app.image'),
            'socials' => __('biolinks::app.socials'),
            'sound-cloud' => __('biolinks::app.soundCloud'),
            'spotify' => __('biolinks::app.spotify'),
            'youtube' => __('biolinks::app.youtube'),
            'twitch' => __('biolinks::app.twitch'),
            'tiktok' => __('biolinks::app.tiktok'),
            'threads' => __('biolinks::app.threads'),
        ];

        if (array_key_exists($request->type, $typeNames)) {
            // Set the block name based on the type
            $block->name = $typeNames[$request->type];
            $block->save();
        }

        if (request()->hasFile('image')) {
            $block->image = Files::uploadLocalOrS3(request()->image, BiolinkBlocks::FILE_PATH);
            $block->save();
        }

        $redirectUrl = route('biolinks.edit', $request->biolink_id) . '?tab=blocks';

        return Reply::successWithData(__('messages.recordSaved'), ['redirectUrl' => $redirectUrl]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateBiolinkBlocks $request, $id)
    {
        switch ($request->type) {
        case 'link':
            $this->updateLink($request, $id);
            break;
        case 'heading':
            $this->updateHeading($request, $id);
            break;
        case 'paragraph':
            $this->updateParagraph($request, $id);
            break;
        case 'avatar':
            $this->updateAvatar($request, $id);
            break;
        case 'image':
            $this->updateImage($request, $id);
            break;
        case 'socials':
            $this->updateSocials($request, $id);
            break;
        case 'email-collector':
        case 'phone-collector':
            $this->updateCollector($request, $id);
            break;
        case 'paypal':
            $this->updatePaypal($request, $id);
            break;
        case 'embeds':
            $this->updateEmbeds($request, $id);
            break;
        }

        return Reply::success(__('messages.updateSuccess'));
    }

    public function updateLink(Request $request, $id)
    {
        $block = BiolinkBlocks::findOrFail($id);
        $block->name = $request->name;
        $block->url = $request->url;
        $block->open_in_new_tab = $request->open_in_new_tab == 1 ? true : false;
        $block->text_color = $request->text_color;
        $block->text_alignment = $request->text_alignment;
        $block->background_color = $request->background_color;
        $block->animation = $request->animation;
        $block->border_width = $request->border_width ?? 0;
        $block->border_radius = $request->border_radius ?? null;
        $block->border_color = $request->border_color;
        $block->border_style = $request->border_style ?? null;
        $block->border_shadow_x = $request->border_shadow_x ?? 0;
        $block->border_shadow_y = $request->border_shadow_y ?? 0;
        $block->border_shadow_blur = $request->border_shadow_blur ?? 20;
        $block->border_shadow_spread = $request->border_shadow_spread ?? 0;
        $block->border_shadow_color = $request->border_shadow_color;
        $block->update();

        return Reply::success(__('messages.recordUpdated'));
    }

    public function updateHeading(Request $request, $id)
    {
        $block = BiolinkBlocks::findOrFail($id);
        $block->heading_type = $request->heading_type;
        $block->name = $request->name;
        $block->text_color = $request->text_color;
        $block->text_alignment = $request->text_alignment;
        $block->update();

        return Reply::success(__('messages.recordUpdated'));
    }

    public function updateParagraph(Request $request, $id)
    {
        $block = BiolinkBlocks::findOrFail($id);
        $block->paragraph = $request->paragraph;
        $block->text_color = $request->text_color;
        $block->text_alignment = $request->text_alignment;
        $block->background_color = $request->background_color;
        $block->border_width = $request->border_width ?? 0;
        $block->border_radius = $request->border_radius ?? null;
        $block->border_color = $request->border_color;
        $block->border_style = $request->border_style ?? null;
        $block->border_shadow_x = $request->border_shadow_x ?? 0;
        $block->border_shadow_y = $request->border_shadow_y ?? 0;
        $block->border_shadow_blur = $request->border_shadow_blur ?? 20;
        $block->border_shadow_spread = $request->border_shadow_spread ?? 0;
        $block->border_shadow_color = $request->border_shadow_color;
        $block->update();

        return Reply::success(__('messages.recordUpdated'));
    }

    public function updateAvatar(Request $request, $id)
    {
        $block = BiolinkBlocks::findOrFail($id);
        $block->image_alt = $request->image_alt;
        $block->url = $request->url;
        $block->avatar_size = $request->avatar_size;
        $block->open_in_new_tab = $request->open_in_new_tab == 1 ? true : false;
        $block->object_fit = $request->object_fit;
        $block->border_width = $request->border_width ?? 0;
        $block->border_radius = $request->border_radius ?? null;
        $block->border_color = $request->border_color;
        $block->border_style = $request->border_style ?? null;
        $block->border_shadow_x = $request->border_shadow_x ?? 0;
        $block->border_shadow_y = $request->border_shadow_y ?? 0;
        $block->border_shadow_blur = $request->border_shadow_blur ?? 20;
        $block->border_shadow_spread = $request->border_shadow_spread ?? 0;
        $block->border_shadow_color = $request->border_shadow_color;

        if ($request->image_delete == 'yes') {
            Files::deleteFile($block->image, 'biolinks');
            $block->image = null;
        }

        if (request()->hasFile('image')) {
            $block->image = Files::uploadLocalOrS3(request()->image, BiolinkBlocks::FILE_PATH);
        }

        $block->update();

        return Reply::success(__('messages.recordUpdated'));
    }

    public function updateImage(Request $request, $id)
    {
        $block = BiolinkBlocks::findOrFail($id);
        $block->image_alt = $request->image_alt;
        $block->url = $request->url;
        $block->open_in_new_tab = $request->open_in_new_tab == 1 ? true : false;

        if ($request->image_delete == 'yes') {
            Files::deleteFile($block->image, 'biolinks');
            $block->image = null;
        }

        if (request()->hasFile('image')) {
            if ($block->image) {
                Files::deleteFile($block->image, 'biolinks');
            }

            $block->image = Files::uploadLocalOrS3(request()->image, BiolinkBlocks::FILE_PATH);
        }

        $block->update();

        return Reply::success(__('messages.recordUpdated'));
    }

    public function updateSocials(Request $request, $id)
    {
        $block = BiolinkBlocks::findOrFail($id);
        $block->text_color = $request->text_color;
        $block->icon_size = $request->icon_size;
        $block->email = $request->email;
        $block->phone = $request->phone;
        $block->telegram = $request->telegram;
        $block->whatsapp = $request->whatsapp;
        $block->facebook = $request->facebook;
        $block->instagram = $request->instagram;
        $block->twitter = $request->twitter;
        $block->youtube = $request->youtube;
        $block->linkedin = $request->linkedin;
        $block->discord = $request->discord;
        $block->snapchat = $request->snapchat;
        $block->pinterest = $request->pinterest;
        $block->reddit = $request->reddit;
        $block->tiktok = $request->tiktok;
        $block->spotify = $request->spotify;
        $block->address = $request->address;
        $block->threads = $request->threads;
        $block->twitch = $request->twitch;
        $block->update();

        return Reply::success(__('messages.recordUpdated'));
    }

    public function updateCollector(Request $request, $id)
    {
        $block = BiolinkBlocks::findOrFail($id);

        if ($request->type == 'email-collector') {
            $block->placeholder = $request->email_placeholder;
            $block->api_key = $request->api_key;
            $block->mailchimp_list = $request->mailchimp_list;
        }
        else {
            $block->placeholder = $request->phone_placeholder;
        }

        $block->name_placeholder = $request->name_placeholder;
        $block->button_text = $request->button_text;
        $block->thank_you_message = $request->thank_you_message;
        $block->thank_you_url = $request->thank_you_url;
        $block->show_agreement = $request->show_agreement == 1 ? true : false;
        $block->agreement_text = $request->agreement_text;
        $block->agreement_url = $request->agreement_url;
        $block->email = $request->email;
        $block->webhook_url = $request->webhook_url;

        $block->name = $request->name;
        $block->text_color = $request->text_color;
        $block->text_alignment = $request->text_alignment;
        $block->background_color = $request->background_color;
        $block->animation = $request->animation;
        $block->border_width = $request->border_width ?? 0;
        $block->border_radius = $request->border_radius ?? null;
        $block->border_color = $request->border_color;
        $block->border_style = $request->border_style ?? null;
        $block->border_shadow_x = $request->border_shadow_x ?? 0;
        $block->border_shadow_y = $request->border_shadow_y ?? 0;
        $block->border_shadow_blur = $request->border_shadow_blur ?? 20;
        $block->border_shadow_spread = $request->border_shadow_spread ?? 0;
        $block->border_shadow_color = $request->border_shadow_color;

        $block->update();

        return Reply::success(__('messages.recordUpdated'));
    }

    public function updatePaypal(Request $request, $id)
    {
        $block = BiolinkBlocks::findOrFail($id);
        $block->paypal_type = $request->paypal_type;
        $block->email = $request->email;
        $block->product_title = $request->product_title;
        $block->currency_code = $request->currency_code;
        $block->price = $request->price;
        $block->thank_you_url = $request->thank_you_url;
        $block->cancelled_payment_url = $request->cancelled_payment_url;

        $block->name = $request->name;
        $block->open_in_new_tab = $request->open_in_new_tab == 1 ? true : false;
        $block->text_color = $request->text_color;
        $block->text_alignment = $request->text_alignment;
        $block->background_color = $request->background_color;
        $block->animation = $request->animation;
        $block->border_width = $request->border_width ?? 0;
        $block->border_radius = $request->border_radius ?? null;
        $block->border_color = $request->border_color;
        $block->border_style = $request->border_style ?? null;
        $block->border_shadow_x = $request->border_shadow_x ?? 0;
        $block->border_shadow_y = $request->border_shadow_y ?? 0;
        $block->border_shadow_blur = $request->border_shadow_blur ?? 20;
        $block->border_shadow_spread = $request->border_shadow_spread ?? 0;
        $block->border_shadow_color = $request->border_shadow_color;
        $block->update();

        return Reply::success(__('messages.recordUpdated'));
    }

    public function updateEmbeds(Request $request, $id)
    {
        $block = BiolinkBlocks::findOrFail($id);
        $block->url = $request->url;
        $block->update();

        return Reply::success(__('messages.recordUpdated'));
    }

    public function sortFields()
    {
        $sortedValues = request('sortedValues');

        foreach ($sortedValues as $key => $value) {
            BiolinkBlocks::where('id', $value)->update(['position' => $key + 1]);
        }

        return Reply::dataOnly([]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $block = BiolinkBlocks::findOrFail($id);

        if ($block->image) {
            Files::deleteFile($block->image, 'biolinks');
        }

        $block->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    public function duplicateBlock($id)
    {

        $block = BiolinkBlocks::findOrFail($id);
        $newBlock = $block->replicate();
        $newBlock->position = $block->position + 1;
        $newBlock->save();

        BiolinkBlocks::whereNotIn('id', [$newBlock->id, $block->id])->where('position', '>=', $newBlock->position)->increment('position');

        return Reply::success(__('messages.recordSaved'));
    }

}
