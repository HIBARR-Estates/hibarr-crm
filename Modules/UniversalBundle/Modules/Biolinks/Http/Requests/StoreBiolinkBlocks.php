<?php

namespace Modules\Biolinks\Http\Requests;

use Illuminate\Validation\Rule;
use Modules\Biolinks\Enums\AvatarSize;
use Illuminate\Foundation\Http\FormRequest;
use Modules\Biolinks\Enums\BorderRadius;
use Modules\Biolinks\Enums\Heading;
use Modules\Biolinks\Enums\PaypalType;
use Modules\Biolinks\Enums\Size;

class StoreBiolinkBlocks extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {

        $type = request()->type;

        switch ($type) {
        case 'link':
            $rules = [
                'name' => ['required', 'string', 'max:255'],
                'url' => ['required', 'url'],
            ];
            break;
        case 'heading':
            $rules = [
                'name' => ['required', 'string', 'max:255'],
                'heading_type' => [Rule::enum(Heading::class)],
            ];
            break;
        case 'paragraph':
            $rules = [
                'paragraph' => ['required', 'string'],
            ];
            break;
        case 'avatar':
            $rules = [
                'image' => ['required', 'image'],
                'avatar_size' => [Rule::enum(AvatarSize::class)],
                'border_radius' => [Rule::enum(BorderRadius::class)],
            ];
            break;
        case 'image':
            $rules = [
                'image' => ['required', 'image'],
                'image_alt' => ['required', 'string'],
                'url' => ['required', 'url'],
            ];
            break;
        case 'socials':
            $rules = [
                'text_color' => ['required', 'string'],
                'size' => [Rule::enum(Size::class)],
                'email' => 'nullable|email:rfc,strict',
            ];
            break;
        case 'paypal':
            $rules = [
                'paypal_type' => [Rule::enum(PaypalType::class)],
                'email' => ['required', 'email'],
                'product_title' => ['required', 'string'],
                'currency_code' => ['required', 'string', 'size:3'],
                'price' => ['required', 'numeric'],
                'name' => ['required', 'string'],
            ];
            break;
        case 'sound-cloud':
            $rules = [
                'url' => ['required', 'url', function ($attribute, $value, $fail) {
                    if (!preg_match('/^(https?:\/\/)?(www\.)?soundcloud\.com\/.*/i', $value)) {
                        $fail('The '.$attribute.' must be a valid SoundCloud URL.');
                    }
                }],
            ];
            break;
        case 'spotify':
            $rules = [
                'url' => ['required', 'url', function ($attribute, $value, $fail) {
                    if (!preg_match('/^(https?:\/\/)?(www\.)?open\.spotify\.com\/.*/i', $value)) {
                        $fail('The '.$attribute.' must be a valid Spotify URL.');
                    }
                }],
            ];
            break;
        case 'youtube':
            $rules = [
                'url' => ['required', 'url', function ($attribute, $value, $fail) {
                    if (!preg_match('/^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/i', $value) && !preg_match('/^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/i', $value)) {
                        $fail('The '.$attribute.' must be a valid YouTube URL.');
                    }
                }],
            ];
            break;
        case 'threads':
            $rules = [
                'url' => ['required', 'url', function ($attribute, $value, $fail) {
                    if (!preg_match('/^(https?:\/\/)?(www\.)?threads\.net\/.*/i', $value)) {
                        $fail('The '.$attribute.' must be a valid Threads URL.');
                    }
                }],
            ];
            break;
        case 'tiktok':
            $rules = [
                'url' => ['required', 'url', function ($attribute, $value, $fail) {
                    if (!preg_match('/^(https?:\/\/)?(www\.)?tiktok\.com\/.*/i', $value)) {
                        $fail('The '.$attribute.' must be a valid TikTok URL.');
                    }
                }],
            ];
            break;
        case 'twitch':
            $rules = [
                'url' => ['required', 'url', function ($attribute, $value, $fail) {
                    if (!preg_match('/^(https?:\/\/)?(www\.)?twitch\.tv\/.*/i', $value)) {
                        $fail('The '.$attribute.' must be a valid Twitch URL.');
                    }
                }],
            ];
            break;
        default:
            $rules = [
                'name' => ['required', 'string', 'max:255'],
            ];
            break;
        }

        return $rules;
    }

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation attributes that apply to the request.
     */
    public function attributes(): array
    {
        return [
            'paragraph' => __('app.text'),
            'avatar_size' => __('biolinks::app.avatarSize'),
            'border_radius' => __('biolinks::app.borderRadius'),
            'image_alt' => __('biolinks::app.imageAlt'),
            'text_color' => __('modules.tasks.labelColor'),
        ];
    }

}
