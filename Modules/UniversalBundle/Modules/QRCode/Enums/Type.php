<?php

namespace Modules\QRCode\Enums;

enum Type: string
{
    case email = 'email';
    case event = 'event';
    case geo = 'geo';
    case paypal = 'paypal';
    case skype = 'skype';
    case sms = 'sms';
    case tel = 'tel';
    case text = 'text';
    case upi = 'upi';
    case url = 'url';
    case whatsapp = 'whatsapp';
    case wifi = 'wifi';
    case zoom = 'zoom';

    public function iconClass(): string
    {
        return match ($this) {
            self::email => 'fa fa-envelope',
            self::event => 'fa fa-calendar-alt',
            self::geo => 'fa fa-map-marker-alt',
            self::paypal => 'fab fa-paypal',
            self::skype => 'fab fa-skype',
            self::sms => 'fa fa-sms',
            self::tel => 'fa fa-phone',
            self::text => 'fa fa-align-left',
            self::upi => 'fa fa-money-bill-alt',
            self::url => 'fa fa-link',
            self::whatsapp => 'fab fa-whatsapp',
            self::wifi => 'fa fa-wifi',
            self::zoom => 'fa fa-video',
            default => 'fa fa-align-left',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::email => __('qrcode::app.type.email'),
            self::event => __('qrcode::app.type.event'),
            self::geo => __('qrcode::app.type.geo'),
            self::paypal => __('qrcode::app.type.paypal'),
            self::skype => __('qrcode::app.type.skype'),
            self::sms => __('qrcode::app.type.sms'),
            self::tel => __('qrcode::app.type.tel'),
            self::text => __('qrcode::app.type.text'),
            self::upi => __('qrcode::app.type.upi'),
            self::url => __('qrcode::app.type.url'),
            self::whatsapp => __('qrcode::app.type.whatsapp'),
            self::wifi => __('qrcode::app.type.wifi'),
            self::zoom => __('qrcode::app.type.zoom'),
            default => __('qrcode::app.type.text'),
        };
    }

    public function labelWithIcon(): string
    {
        return '<i class="' . $this->iconClass() . '"></i> ' . $this->label();
    }

    public function badge(): string
    {
        return '<span class="badge badge-pill f-11 ' . $this->badgeStyle() . '">' . $this->labelWithIcon() . '</span>';
    }

    public function badgeStyle() : string
    {
        return match ($this) {
            self::email => 'badge-primary',
            self::event => 'badge-success',
            self::geo => 'badge-info',
            self::paypal => 'badge-warning',
            self::skype => 'badge-danger',
            self::sms => 'badge-dark',
            self::tel => 'badge-secondary',
            self::text => 'badge-light',
            self::upi => 'badge-primary',
            self::url => 'badge-success',
            self::whatsapp => 'badge-info',
            self::wifi => 'badge-warning',
            self::zoom => 'badge-danger',
            default => 'badge-light',
        };
    }

    public static function toArray(): array
    {
        $types = [];

        foreach (self::cases() as $type) {
            $types[] = $type->value;
        }

        return $types;
    }

}
