<?php

namespace Modules\QRCode\Enums;

enum Format: string
{
    case svg = 'svg';
    case png = 'png';
    case gif = 'gif';
    case webp = 'webp';
    case pdf = 'pdf';
    case eps = 'eps';

    public function label(): string
    {
        return match ($this) {
            self::svg => __('qrcode::app.format.svg'),
            self::png => __('qrcode::app.format.png'),
            self::gif => __('qrcode::app.format.gif'),
            self::webp => __('qrcode::app.format.webp'),
            self::pdf => __('qrcode::app.format.pdf'),
            self::eps => __('qrcode::app.format.eps'),
            default => __('qrcode::app.format.png'),
        };
    }

    public function iconClass(): string
    {
        return match ($this) {
            self::svg => 'fa fa-file-code',
            self::png => 'fa fa-file-image',
            self::gif => 'fas fa-photo-video',
            self::webp => 'fa fa-file-image',
            self::pdf => 'fa fa-file-pdf',
            self::eps => 'fas fa-bezier-curve',
            default => 'fa fa-file-image',
        };
    }

    public function labelWithIcon(): string
    {
        return '<i class="' . $this->iconClass() . '"></i> ' . $this->label();
    }

}
