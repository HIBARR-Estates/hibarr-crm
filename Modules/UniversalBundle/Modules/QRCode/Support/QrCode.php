<?php

namespace Modules\QRCode\Support;

use Endroid\QrCode\Color\Color;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\RoundBlockSizeMode;
use Modules\QRCode\Entities\QrCodeData;
use Modules\QRCode\Traits\QrTypes;

class QrCode
{
    use QrTypes;

    public static function generate()
    {
        $result = new QrBuilder();

        $result->encoding(new Encoding('UTF-8'))
            ->errorCorrectionLevel(ErrorCorrectionLevel::High)
            ->roundBlockSizeMode(RoundBlockSizeMode::Margin)
            ->setSize(200)
            ->margin(0)
            ->validateResult(false);

        return $result;
    }

    /**
     * Converts a hexadecimal, rgb and rgba color code to a Color object.
     *
     * @param string $hex The hexadecimal color code.
     * @return Color The Color object representing the converted color.
     */
    public static function color(string $hex = '#1100ff')
    {
        if (!str($hex)->startsWith('#')) {
            $colorArray = explode(',', str_replace(' ', '', $hex));

            if (count($colorArray) >= 3) {

                if (count($colorArray) == 4) {
                    [$r, $g, $b, $a] = $colorArray;
                    return new Color($r, $g, $b, self::opacityConvert($a));
                }

                [$r, $g, $b] = $colorArray;
                return new Color($r, $g, $b);
            }
        }

        list($r, $g, $b) = sscanf($hex, '#%02x%02x%02x');
        return new Color($r, $g, $b);
    }

    /**
     * Converts the opacity value to the appropriate format.
     *
     * @param float $opacity The opacity value to be converted.
     * @return int The converted opacity value.
     */
    public static function opacityConvert($opacity)
    {
        if ($opacity > 1) {
            return $opacity;
        }

        $converted = ($opacity * 127);

        return (int)(127 - $converted);
    }

    public static function buildQrCode(QrCodeData $qrData, $logo = true)
    {
        $qr = QrCode::text($qrData->data ?: ' ')
            ->setSize($qrData->size)
            ->margin($qrData->margin)
            ->backgroundColor(self::color($qrData->background_color))
            ->foregroundColor(self::color($qrData->foreground_color));

        if ($qrData->logo && $logo) {
            if (@file_get_contents($qrData->logo_url)) {
                $qr->logoPath($qrData->logo_url);

                if ($qrData->logo_size) {
                    $qr->logoResizeToWidth(self::qrLogoSize($qrData->size, $qrData->logo_size));
                }
            }
        }

        return $qr;
    }

    public static function qrLogoSize(int|float $qrSize, int|float $logoSize) : int
    {
        $qr30Percent = $qrSize * 0.3;

        $logoSizePercent = $logoSize ?: 100;

        // calculate logo size of 30% of the qr code
        $logoSize = ($qr30Percent * $logoSizePercent) / 100;

        return (int)round($logoSize);

    }

}
