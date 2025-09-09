<!DOCTYPE html>

<html lang="en">

<head>
    <!-- Required meta tags -->
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

    <!-- Font Awesome Icons -->
    <link rel="stylesheet" href="{{ asset('vendor/css/all.min.css') }}">

    <!-- Template CSS -->
    <link type="text/css" rel="stylesheet" media="all" href="{{ asset('css/main.css') }}">

    <!-- Simple Line Icons -->
    <link rel="stylesheet" href="{{ asset('vendor/css/simple-line-icons.css') }}" defer="defer">

    <!-- Datepicker -->
    <link rel="stylesheet" href="{{ asset('vendor/css/datepicker.min.css') }}" defer="defer">

    <!-- TimePicker -->
    <link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-timepicker.min.css') }}" defer="defer">

    <!-- Select Plugin -->
    <link rel="stylesheet" href="{{ asset('vendor/css/select2.min.css') }}" defer="defer">

    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="{{ asset('vendor/css/bootstrap-icons.css') }}" defer="defer">

    <!-- Bootstrap CSS -->
    <link type="text/css" rel="stylesheet" media="all" href="{{ asset('css/main.css') }}">

    <!-- Settings CSS -->
    <style>
        body {
            min-height: 100vh;
            background-color: transparent;
            font-family: {{ $biolinkSettings->font->familyValue() }};
        }

        .badge-success {
            /* border-radius: 20px; */
            border-radius: 20px 0 0 20px;
            position: fixed;
            left: 92%;
            transform: translateX(-50%);
            display: inline-flex;
            justify-content: right;
        }

        #verified-icon {
            margin-right: 5px;
            font-size: 18px;
        }

        #brand-container {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: right;
        }

        #branding-url {
            text-decoration: none;
            vertical-align: middle;
            color: {{ $biolinkSettings->branding_text_color }};
        }

        #badge-verified {
            margin-left: 1px;
        }
    </style>

    @if ($biolinkSettings->verified_badge != \Modules\Biolinks\Enums\VerifiedBadge::TOP)
        <style>
            .blocks-div {
                margin-top: 20px;
            }
        </style>
    @endif

    @if ($biolinkSettings->verified_badge == \Modules\Biolinks\Enums\VerifiedBadge::NONE)
        <style>
            #verified-badge {
                display: none;
            }
        </style>
    @elseif ($biolinkSettings->verified_badge == \Modules\Biolinks\Enums\VerifiedBadge::TOP)
        <style>
            .blocks-div {
                margin-top: 40px;
            }
        </style>
    @endif

    @if (!$biolinkSettings->branding_name)
        <style>
            #branding-container {
                display: none;
            }
        </style>
    @endif

    <!-- Blocks CSS -->
    <style>
        .rounded-20 {
            border-radius: 20px !important;
        }
    </style>

    <!-- Custom CSS -->
</head>

<body>

    <div class="box">
        <div class="blocks-div d-flex flex-column"
            style="{{ $biolinkSettings->block_space == \Modules\Biolinks\Enums\BlockSpacing::LARGE ? 'gap: 30px; margin-bottom: 30px;' : ($biolinkSettings->block_space == \Modules\Biolinks\Enums\BlockSpacing::MEDIUM ? 'gap: 20px; margin-bottom: 20px;' : 'gap: 10px;  margin-bottom: 10px;') }}">

            <!-- Verified Badge with Icon start -->
            <span id="verified-badge" class="badge badge-success" style="{{ $biolinkSettings->verified_badge->value }}: 10px;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                    class="bi bi-check2-circle" width="17" height="17">
                    <path fill-rule="evenodd"
                        d="M10 0a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm5.354 7.646a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708l3.146 3.147 6.646-6.647a.5.5 0 0 1 .708 0z" />
                </svg>
                <span id="badge-verified">@lang('biolinks::app.verified')</span>
            </span>
            <!-- Verified badge end -->

            <!-- Blocks data start -->
            @foreach ($blocks as $block)
                @if ($block->type == 'heading')
                    <div class="col-12">
                        <{{ $block->heading_type }} class="text-break m-0 heading-font" data-block-id="{{ $block->id }}"
                            style="color: {{ $block->text_color }}; text-align: {{ $block->text_alignment->value }};"> {{ $block->name }}
                            </{{ $block->heading_type }}>
                    </div>
                @endif
                @if (
                    $block->type == 'link' ||
                        $block->type == 'email-collector' ||
                        $block->type == 'phone-collector' ||
                        $block->type == 'paypal')
                    <div class="col-12" style="text-align: center;">
                        <a class="btn f-20 w-100 py-2 text-break {{ $block->border_radius === \Modules\Biolinks\Enums\BorderRadius::ROUND ? 'rounded-pill' : ($block->border_radius === \Modules\Biolinks\Enums\BorderRadius::STRAIGHT ? 'rounded-0' : 'rounded') }}"
                            data-block-id="{{ $block->id }}"
                            style="background: {{ $block->background_color }} !important; color: {{ $block->text_color }} !important; border-width: {{ $block->border_width }}px !important;
                            border-color: {{ $block->border_color }}; border-style: {{ $block->border_style }}; text-align: {{ $block->text_alignment->value }};
                            box-shadow: {{ $block->border_shadow_x }}px {{ $block->border_shadow_y }}px {{ $block->border_shadow_blur }}px {{ $block->border_shadow_spread }}px {{ $block->border_shadow_color }};">
                            {{ $block->name }}
                        </a>
                    </div>
                @endif
                @if ($block->type == 'paragraph')
                    <div class="col-12" style="text-align: center;">
                        <p class="btn w-100 f-20 py-2 mb-0 text-break overflow-auto {{ $block->border_radius === \Modules\Biolinks\Enums\BorderRadius::ROUND ? 'rounded-20' : ($block->border_radius === \Modules\Biolinks\Enums\BorderRadius::STRAIGHT ? 'rounded-0' : 'rounded') }}"
                            data-block-id="{{ $block->id }}"
                            style="background: {{ $block->background_color }} !important; color: {{ $block->text_color }} !important; border-width: {{ $block->border_width }}px !important;
                            border-color: {{ $block->border_color }}; border-style: {{ $block->border_style }};
                            box-shadow: {{ $block->border_shadow_x }}px {{ $block->border_shadow_y }}px {{ $block->border_shadow_blur }}px {{ $block->border_shadow_spread }}px {{ $block->border_shadow_color }};
                            text-align: {{ $block->text_alignment->value }};
                            cursor: default;">
                            {!! nl2br($block->paragraph) !!}
                        </p>
                    </div>
                @endif
                @if ($block->type == 'avatar')
                    <div class="col-12 d-flex flex-column align-items-center">
                        <a>
                            <img src="{{ $block->file_url }}" data-block-id="{{ $block->id }}"
                                class="link-image link-avatar-straight {{ $block->border_radius == \Modules\Biolinks\Enums\BorderRadius::ROUND ? 'rounded-circle' : ($block->border_radius == \Modules\Biolinks\Enums\BorderRadius::STRAIGHT ? 'rounded-0' : 'rounded') }}"
                                style="width: {{ $block->avatar_size }}px; height: {{ $block->avatar_size }}px; border-width: {{ $block->border_width }}px !important; border-color: {{ $block->border_color }}; border-style: {{ $block->border_style }}; object-fit: {{ $block->object_fit->value }};"
                                alt="{{ $block->image_alt }}" loading="lazy">
                        </a>
                    </div>
                @endif
                @if ($block->type == 'image')
                    <div class="col-12">
                        <a>
                            <img src="{{ $block->file_url }}" data-block-id="{{ $block->id }}"
                                class="img-fluid rounded link-hover-animation-smooth" alt="{{ $block->image_alt }}">
                        </a>
                    </div>
                @endif
                @if ($block->type == 'socials')
                    <div class="d-flex flex-wrap justify-content-center">
                        @if ($block->email)
                            <div class="my-2 mx-3" data-toggle="tooltip" title="" data-original-title="Email">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-envelope fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fas" data-icon="envelope"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->phone)
                            <div class="my-2 mx-3" data-toggle="tooltip" title="" data-original-title="Telephone">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-square-phone-flip fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fas"
                                        data-icon="square-phone-flip" role="img"
                                        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M384 32c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96C0 60.7 28.7 32 64 32H384zm-90.7 96.7c-9.7-2.6-19.9 2.3-23.7 11.6l-20 48c-3.4 8.2-1 17.6 5.8 23.2L280 231.7c-16.6 35.2-45.1 63.7-80.3 80.3l-20.2-24.7c-5.6-6.8-15-9.2-23.2-5.8l-48 20c-9.3 3.9-14.2 14-11.6 23.7l12 44C111.1 378 119 384 128 384c123.7 0 224-100.3 224-224c0-9-6-16.9-14.7-19.3l-44-12z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->telegram)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Telegram">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-telegram fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="telegram"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 496 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M248,8C111.033,8,0,119.033,0,256S111.033,504,248,504,496,392.967,496,256,384.967,8,248,8ZM362.952,176.66c-3.732,39.215-19.881,134.378-28.1,178.3-3.476,18.584-10.322,24.816-16.948,25.425-14.4,1.326-25.338-9.517-39.287-18.661-21.827-14.308-34.158-23.215-55.346-37.177-24.485-16.135-8.612-25,5.342-39.5,3.652-3.793,67.107-61.51,68.335-66.746.153-.655.3-3.1-1.154-4.384s-3.59-.849-5.135-.5q-3.283.746-104.608,69.142-14.845,10.194-26.894,9.934c-8.855-.191-25.888-5.006-38.551-9.123-15.531-5.048-27.875-7.717-26.8-16.291q.84-6.7,18.45-13.7,108.446-47.248,144.628-62.3c68.872-28.647,83.183-33.623,92.511-33.789,2.052-.034,6.639.474,9.61,2.885a10.452,10.452,0,0,1,3.53,6.716A43.765,43.765,0,0,1,362.952,176.66Z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->whatsapp)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Whatsapp">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-whatsapp fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="whatsapp"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->facebook)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Facebook">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-facebook fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="facebook"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.78 90.69 226.38 209.25 245V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.28c-30.8 0-40.41 19.12-40.41 38.73V256h68.78l-11 71.69h-57.78V501C413.31 482.38 504 379.78 504 256z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->instagram)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Instagram">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-instagram fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="instagram"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->twitter)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Twitter">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-twitter fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="twitter"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->tiktok)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="TikTok">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-tiktok fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="tiktok"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->youtube)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="YouTube Channel">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-youtube fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="youtube"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->linkedin)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="LinkedIn">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-linkedin fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="linkedin"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->spotify)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Spotify">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-spotify fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="spotify"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 496 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8zm100.7 364.9c-4.2 0-6.8-1.3-10.7-3.6-62.4-37.6-135-39.2-206.7-24.5-3.9 1-9 2.6-11.9 2.6-9.7 0-15.8-7.7-15.8-15.8 0-10.3 6.1-15.2 13.6-16.8 81.9-18.1 165.6-16.5 237 26.2 6.1 3.9 9.7 7.4 9.7 16.5s-7.1 15.4-15.2 15.4zm26.9-65.6c-5.2 0-8.7-2.3-12.3-4.2-62.5-37-155.7-51.9-238.6-29.4-4.8 1.3-7.4 2.6-11.9 2.6-10.7 0-19.4-8.7-19.4-19.4s5.2-17.8 15.5-20.7c27.8-7.8 56.2-13.6 97.8-13.6 64.9 0 127.6 16.1 177 45.5 8.1 4.8 11.3 11 11.3 19.7-.1 10.8-8.5 19.5-19.4 19.5zm31-76.2c-5.2 0-8.4-1.3-12.9-3.9-71.2-42.5-198.5-52.7-280.9-29.7-3.6 1-8.1 2.6-12.9 2.6-13.2 0-23.3-10.3-23.3-23.6 0-13.6 8.4-21.3 17.4-23.9 35.2-10.3 74.6-15.2 117.5-15.2 73 0 149.5 15.2 205.4 47.8 7.8 4.5 12.9 10.7 12.9 22.6 0 13.6-11 23.3-23.2 23.3z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->pinterest)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Pinterest">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-pinterest fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="pinterest"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 496 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M496 256c0 137-111 248-248 248-25.6 0-50.2-3.9-73.4-11.1 10.1-16.5 25.2-43.5 30.8-65 3-11.6 15.4-59 15.4-59 8.1 15.4 31.7 28.5 56.8 28.5 74.8 0 128.7-68.8 128.7-154.3 0-81.9-66.9-143.2-152.9-143.2-107 0-163.9 71.8-163.9 150.1 0 36.4 19.4 81.7 50.3 96.1 4.7 2.2 7.2 1.2 8.3-3.3.8-3.4 5-20.3 6.9-28.1.6-2.5.3-4.7-1.7-7.1-10.1-12.5-18.3-35.3-18.3-56.6 0-54.7 41.4-107.6 112-107.6 60.9 0 103.6 41.5 103.6 100.9 0 67.1-33.9 113.6-78 113.6-24.3 0-42.6-20.1-36.7-44.8 7-29.5 20.5-61.3 20.5-82.6 0-19-10.2-34.9-31.4-34.9-24.9 0-44.9 25.7-44.9 60.2 0 22 7.4 36.8 7.4 36.8s-24.5 103.8-29 123.2c-5 21.4-3 51.6-.9 71.2C65.4 450.9 0 361.1 0 256 0 119 111 8 248 8s248 111 248 248z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->snapchat)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Snapchat">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-snapchat fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="snapchat"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M496.926,366.6c-3.373-9.176-9.8-14.086-17.112-18.153-1.376-.806-2.641-1.451-3.72-1.947-2.182-1.128-4.414-2.22-6.634-3.373-22.8-12.09-40.609-27.341-52.959-45.42a102.889,102.889,0,0,1-9.089-16.12c-1.054-3.013-1-4.724-.248-6.287a10.221,10.221,0,0,1,2.914-3.038c3.918-2.591,7.96-5.22,10.7-6.993,4.885-3.162,8.754-5.667,11.246-7.44,9.362-6.547,15.909-13.5,20-21.278a42.371,42.371,0,0,0,2.1-35.191c-6.2-16.318-21.613-26.449-40.287-26.449a55.543,55.543,0,0,0-11.718,1.24c-1.029.224-2.059.459-3.063.72.174-11.16-.074-22.94-1.066-34.534-3.522-40.758-17.794-62.123-32.674-79.16A130.167,130.167,0,0,0,332.1,36.443C309.515,23.547,283.91,17,256,17S202.6,23.547,180,36.443a129.735,129.735,0,0,0-33.281,26.783c-14.88,17.038-29.152,38.44-32.673,79.161-.992,11.594-1.24,23.435-1.079,34.533-1-.26-2.021-.5-3.051-.719a55.461,55.461,0,0,0-11.717-1.24c-18.687,0-34.125,10.131-40.3,26.449a42.423,42.423,0,0,0,2.046,35.228c4.105,7.774,10.652,14.731,20.014,21.278,2.48,1.736,6.361,4.24,11.246,7.44,2.641,1.711,6.5,4.216,10.28,6.72a11.054,11.054,0,0,1,3.3,3.311c.794,1.624.818,3.373-.36,6.6a102.02,102.02,0,0,1-8.94,15.785c-12.077,17.669-29.363,32.648-51.434,44.639C32.355,348.608,20.2,352.75,15.069,366.7c-3.868,10.528-1.339,22.506,8.494,32.6a49.137,49.137,0,0,0,12.4,9.387,134.337,134.337,0,0,0,30.342,12.139,20.024,20.024,0,0,1,6.126,2.741c3.583,3.137,3.075,7.861,7.849,14.78a34.468,34.468,0,0,0,8.977,9.127c10.019,6.919,21.278,7.353,33.207,7.811,10.776.41,22.989.881,36.939,5.481,5.778,1.91,11.78,5.605,18.736,9.92C194.842,480.951,217.707,495,255.973,495s61.292-14.123,78.118-24.428c6.907-4.24,12.872-7.9,18.489-9.758,13.949-4.613,26.163-5.072,36.939-5.481,11.928-.459,23.187-.893,33.206-7.812a34.584,34.584,0,0,0,10.218-11.16c3.434-5.84,3.348-9.919,6.572-12.771a18.971,18.971,0,0,1,5.753-2.629A134.893,134.893,0,0,0,476.02,408.71a48.344,48.344,0,0,0,13.019-10.193l.124-.149C498.389,388.5,500.708,376.867,496.926,366.6Zm-34.013,18.277c-20.745,11.458-34.533,10.23-45.259,17.137-9.114,5.865-3.72,18.513-10.342,23.076-8.134,5.617-32.177-.4-63.239,9.858-25.618,8.469-41.961,32.822-88.038,32.822s-62.036-24.3-88.076-32.884c-31-10.255-55.092-4.241-63.239-9.858-6.609-4.563-1.24-17.211-10.341-23.076-10.739-6.907-24.527-5.679-45.26-17.075-13.206-7.291-5.716-11.8-1.314-13.937,75.143-36.381,87.133-92.552,87.666-96.719.645-5.046,1.364-9.014-4.191-14.148-5.369-4.96-29.189-19.7-35.8-24.316-10.937-7.638-15.748-15.264-12.2-24.638,2.48-6.485,8.531-8.928,14.879-8.928a27.643,27.643,0,0,1,5.965.67c12,2.6,23.659,8.617,30.392,10.242a10.749,10.749,0,0,0,2.48.335c3.6,0,4.86-1.811,4.612-5.927-.768-13.132-2.628-38.725-.558-62.644,2.84-32.909,13.442-49.215,26.04-63.636,6.051-6.932,34.484-36.976,88.857-36.976s82.88,29.92,88.931,36.827c12.611,14.421,23.225,30.727,26.04,63.636,2.071,23.919.285,49.525-.558,62.644-.285,4.327,1.017,5.927,4.613,5.927a10.648,10.648,0,0,0,2.48-.335c6.745-1.624,18.4-7.638,30.4-10.242a27.641,27.641,0,0,1,5.964-.67c6.386,0,12.4,2.48,14.88,8.928,3.546,9.374-1.24,17-12.189,24.639-6.609,4.612-30.429,19.343-35.8,24.315-5.568,5.134-4.836,9.1-4.191,14.149.533,4.228,12.511,60.4,87.666,96.718C468.629,373.011,476.119,377.524,462.913,384.877Z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->twitch)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Twitch">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-twitch fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="twitch"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M391.17,103.47H352.54v109.7h38.63ZM285,103H246.37V212.75H285ZM120.83,0,24.31,91.42V420.58H140.14V512l96.53-91.42h77.25L487.69,256V0ZM449.07,237.75l-77.22,73.12H294.61l-67.6,64v-64H140.14V36.58H449.07Z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->discord)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Discord">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-discord fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="discord"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6,447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83,1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.82,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->address)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Address">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-location-dot fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fas"
                                        data-icon="location-dot" role="img" xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 384 512" data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->threads)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Threads">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-threads fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="threads"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M331.5 235.7c2.2 .9 4.2 1.9 6.3 2.8c29.2 14.1 50.6 35.2 61.8 61.4c15.7 36.5 17.2 95.8-30.3 143.2c-36.2 36.2-80.3 52.5-142.6 53h-.3c-70.2-.5-124.1-24.1-160.4-70.2c-32.3-41-48.9-98.1-49.5-169.6V256v-.2C17 184.3 33.6 127.2 65.9 86.2C102.2 40.1 156.2 16.5 226.4 16h.3c70.3 .5 124.9 24 162.3 69.9c18.4 22.7 32 50 40.6 81.7l-40.4 10.8c-7.1-25.8-17.8-47.8-32.2-65.4c-29.2-35.8-73-54.2-130.5-54.6c-57 .5-100.1 18.8-128.2 54.4C72.1 146.1 58.5 194.3 58 256c.5 61.7 14.1 109.9 40.3 143.3c28 35.6 71.2 53.9 128.2 54.4c51.4-.4 85.4-12.6 113.7-40.9c32.3-32.2 31.7-71.8 21.4-95.9c-6.1-14.2-17.1-26-31.9-34.9c-3.7 26.9-11.8 48.3-24.7 64.8c-17.1 21.8-41.4 33.6-72.7 35.3c-23.6 1.3-46.3-4.4-63.9-16c-20.8-13.8-33-34.8-34.3-59.3c-2.5-48.3 35.7-83 95.2-86.4c21.1-1.2 40.9-.3 59.2 2.8c-2.4-14.8-7.3-26.6-14.6-35.2c-10-11.7-25.6-17.7-46.2-17.8H227c-16.6 0-39 4.6-53.3 26.3l-34.4-23.6c19.2-29.1 50.3-45.1 87.8-45.1h.8c62.6 .4 99.9 39.5 103.7 107.7l-.2 .2zm-156 68.8c1.3 25.1 28.4 36.8 54.6 35.3c25.6-1.4 54.6-11.4 59.5-73.2c-13.2-2.9-27.8-4.4-43.4-4.4c-4.8 0-9.6 .1-14.4 .4c-42.9 2.4-57.2 23.2-56.2 41.8l-.1 .1z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                        @if ($block->reddit)
                            <div class="my-2 mx-3" data-toggle="tooltip" title=""
                                data-original-title="Reddit">
                                <a class="link-hover-animation-smooth" style="color: {{ $block->text_color }}"
                                    data-block-id="{{ $block->id }}">
                                    <svg class="svg-inline--fa fa-reddit fa-lg fa-fw" data-color=""
                                        aria-hidden="true" focusable="false" data-prefix="fab" data-icon="reddit"
                                        role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"
                                        data-fa-i2svg="">
                                        <path fill="currentColor"
                                            d="M201.5 305.5c-13.8 0-24.9-11.1-24.9-24.6 0-13.8 11.1-24.9 24.9-24.9 13.6 0 24.6 11.1 24.6 24.9 0 13.6-11.1 24.6-24.6 24.6zM504 256c0 137-111 248-248 248S8 393 8 256 119 8 256 8s248 111 248 248zm-132.3-41.2c-9.4 0-17.7 3.9-23.8 10-22.4-15.5-52.6-25.5-86.1-26.6l17.4-78.3 55.4 12.5c0 13.6 11.1 24.6 24.6 24.6 13.8 0 24.9-11.3 24.9-24.9s-11.1-24.9-24.9-24.9c-9.7 0-18 5.8-22.1 13.8l-61.2-13.6c-3-.8-6.1 1.4-6.9 4.4l-19.1 86.4c-33.2 1.4-63.1 11.3-85.5 26.8-6.1-6.4-14.7-10.2-24.1-10.2-34.9 0-46.3 46.9-14.4 62.8-1.1 5-1.7 10.2-1.7 15.5 0 52.6 59.2 95.2 132 95.2 73.1 0 132.3-42.6 132.3-95.2 0-5.3-.6-10.8-1.9-15.8 31.3-16 19.8-62.5-14.9-62.5zM302.8 331c-18.2 18.2-76.1 17.9-93.6 0-2.2-2.2-6.1-2.2-8.3 0-2.5 2.5-2.5 6.4 0 8.6 22.8 22.8 87.3 22.8 110.2 0 2.5-2.2 2.5-6.1 0-8.6-2.2-2.2-6.1-2.2-8.3 0zm7.7-75c-13.6 0-24.6 11.1-24.6 24.9 0 13.6 11.1 24.6 24.6 24.6 13.8 0 24.9-11.1 24.9-24.6 0-13.8-11-24.9-24.9-24.9z">
                                        </path>
                                    </svg>
                                </a>
                            </div>
                        @endif
                    </div>
                @endif
                @if ($block->type == 'sound-cloud')
                    <div data-block-id="{{ $block->id }}" class="col-12">
                        <div class="embed-responsive embed-responsive-16by9 link-iframe-round">
                            <iframe class="embed-responsive-item" scrolling="no" frameborder="no"
                                src="https://w.soundcloud.com/player/?url={{ $block->url }}&amp;color=%23ff5500&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;show_teaser=true&amp;visual=true"></iframe>
                        </div>
                    </div>
                @endif
                @if ($block->type == 'spotify')
                    <div data-block-id="{{ $block->id }}" class="col-12">
                        <div class="embed-responsive embed-responsive-16by9 link-iframe-round" style="height: 152px;">
                            <iframe class="embed-responsive-item" scrolling="no" frameborder="no"
                                src="https://open.spotify.com/embed/{{ str($block->url)->replace('https://open.spotify.com/', '') }}"
                                allowtransparency="true" allow="encrypted-media"></iframe>
                        </div>
                    </div>
                @endif
                @if ($block->type == 'youtube')
                    <div data-block-id="{{ $block->id }}" class="col-12">
                        <div class="embed-responsive embed-responsive-16by9 link-iframe-round">
                            <iframe class="embed-responsive-item"
                                src="https://www.youtube.com/embed/{{ Str::contains($block->url, 'youtu.be') ? Str::afterLast($block->url, '/') : Str::between($block->url, 'watch?v=', '&') }}"
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowfullscreen></iframe>
                        </div>
                    </div>
                @endif
                @if ($block->type == 'threads')
                    <div data-block-id="{{ $block->id }}" class="col-12">
                        <iframe class="embed-responsive-item" src="{{ Str::before($block->url, '?') }}/embed/"
                            frameborder="0" style="height: 500px; width:100%"></iframe>
                    </div>
                @endif
                @if ($block->type == 'tiktok')
                    <div class="link-iframe-round col-12" data-block-id="{{ $block->id }}">
                        <iframe id="dynamic-height-iframe" class="embed-responsive-item"
                            name="__tt_embed__v94380036965818270"
                            sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-top-navigation allow-same-origin"
                            src="https://www.tiktok.com/embed/v2/{{ Str::before(Str::after($block->url, 'video/'), '?') }}"
                            style="width: 100%; height: 500px; display: block; visibility: unset; padding: 10px 0px;"
                            frameborder="0"></iframe>
                    </div>
                @endif
                @if ($block->type == 'twitch')
                    <div class="link-iframe-round col-12" data-block-id="{{ $block->id }}">
                        <iframe class="embed-responsive-item" style="width: 100%; height=400px" allowfullscreen
                            scrolling="no" frameborder="no"
                            src="https://player.twitch.tv/?channel={{ Str::after($block->url, 'https://www.twitch.tv/') }}&amp;autoplay=false&amp;parent={{ $baseUrl }}"></iframe>
                    </div>
                @endif
            @endforeach
            <!-- Blocks data end -->

            <!-- Branding -->
            <div class="col-12 d-flex flex-column align-items-center mb-2">
                <a id="branding-url">@if ($biolinkSettings->branding_name){{ $biolinkSettings->branding_name }} @endif</a>
            </div>
            <!-- Branding end -->
        </div>
    </div>

</body>

<!-- jQuery -->
<script src="{{ asset('vendor/jquery/jquery.min.js') }}"></script>

<!-- Custom CSS -->
<script>
    {!! $biolinkSettings->custom_js !!}
</script>

</html>
