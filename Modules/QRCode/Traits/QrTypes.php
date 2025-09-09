<?php

namespace Modules\QRCode\Traits;

use Illuminate\Support\Carbon;

trait QrTypes
{

    public static function text($text)
    {
        return self::generate()->setData($text);
    }

    public static function email($email, $subject = null, $body = null)
    {
        $data = 'mailto:' . $email;

        if ($subject) {
            $data .= '?subject=' . $subject;
        }

        if ($body) {
            $data .= '&body=' . $body;
        }

        return self::generate()->setData($data);
    }

    public static function url($url)
    {
        if (!str($url)->startsWith('http')) {
            $url = 'http://' . $url;
        }

        return self::generate()->setData($url);
    }

    public static function tel($number, $countryCode = null)
    {
        $data = '';

        if ($countryCode) {
            $data .= '+' . $countryCode;
        }

        $data .= $number;

        return self::generate()->setData('tel:' . $data);
    }

    public static function sms($number, $countryCode = null, $smsBody = null)
    {
        $data = '';

        if ($countryCode) {
            $data .= '+' . $countryCode;
        }

        $data .= $number;

        if ($smsBody) {
            $data .= ':' . $smsBody;
        }

        return self::generate()->setData('SMSTO:' . $data);
    }

    public static function whatsapp($number, $countryCode = null, $text = null)
    {
        $data = 'https://wa.me/';

        if ($countryCode) {
            $data .= '+' . $countryCode;
        }

        $data .= $number;

        if ($text) {
            $data .= '/?text=' . urlencode($text);
        }

        return self::generate()->setData($data);
    }

    public static function skype($username, $type = null)
    {
        $data = 'skype:';
        $type = $type ? $type : 'call';

        $data .= urlencode($username) . '?' . $type;

        return self::generate()->setData($data);
    }

    public static function wifi($ssid, $password = null, $encryption = 'WPA', $hidden = false)
    {
        $data = 'WIFI:S:' . $ssid . ';';

        if ($password) {
            $data .= 'P:' . $password . ';';
        }

        if ($encryption) {
            $data .= 'T:' . $encryption . ';';
        }

        if ($hidden) {
            $data .= 'H:true;';
        }

        return self::generate()->setData($data);
    }

    public static function geo($lat, $lng)
    {
        return self::generate()->setData('geo:' . $lat . ',' . $lng . '?q=' . $lat . ',' . $lng);
    }

    public static function paypal($email, $itemName, $amount = 0, $itemId, $type = '_xclick', $currencyCode = 'USD', $shipping = null, $tax = null)
    {
        $data = 'https://www.paypal.com/cgi-bin/webscr';
        $data .= '?cmd=' . $type;
        $data .= '&business=' . urlencode($email);
        $data .= '&item_name=' . urlencode($itemName);

        if ($itemId) {
            $data .= '&item_number=' . urlencode($itemId);
        }

        $data .= '&amount=' . urlencode($amount);
        $data .= '&currency_code=' . $currencyCode;

        if ($shipping) {
            $data .= '&shipping=' . urlencode($shipping);
        }

        if ($tax) {
            $data .= '&tax=' . urlencode($tax);
        }

        if ($type == '_xclick') {
            $data .= '&button_subtype=services';
            $data .= '&bn='.urlencode('PP-BuyNowBF:btn_buynow_LG.gif:NonHostedGuest');
        }
        else if ($type == '_cart') {
            $data  .= '&button_subtype=products&add=1';
            $data  .= '&bn='.urlencode('PP-ShopCartBF:btn_cart_LG.gif:NonHostedGuest');
        }
        else {
            $data  .= '&bn='.urlencode('PP-DonationsBF:btn_donate_LG.gif:NonHostedGuest');
        }

        $data .= '&lc=US&no_note=0';

        return self::generate()->setData($data);
    }

    public static function event($title, Carbon $startDateTime, Carbon $endDateTime, $location = null, $link = null, $note = null, $reminder = null)
    {
        $data = 'BEGIN:VCALENDAR' . "\n";
        $data .= 'VERSION:2.0' . "\n";
        $data .= 'PRODID:-//QRCode//Froiden 1.0//EN' . "\n";
        $data .= 'BEGIN:VEVENT' . "\n";

        $data .= 'SUMMARY:' . $title . "\n";

        $dateFormat = 'Ymd\THis';

        $data .= 'DTSTART:' . $startDateTime->format($dateFormat) . "\n";
        $data .= 'DTEND:' . $endDateTime->format($dateFormat) . "\n";

        if ($location) {
            $data .= 'LOCATION:' . str($location)
                ->replace(',', '\\,')
                ->replace(';', '\\;')->__toString() . "\n";
        }

        if ($link) {
            $data .= 'URL:' . $link . "\n";
            $data .= 'CLASS:PUBLIC' . "\n";
        }

        if ($note) {
            $data .= 'DESCRIPTION:' . str($note)
                ->replace('\r\n', '\\n')
                ->replace('\n', '\\n')
                ->replace(',', '\\,')
                ->replace(';', '\\;')->__toString() . "\n";
        }

        if ($reminder) {
            $data .= 'BEGIN:VALARM'."\n";
            $data .= 'TRIGGER:'.$reminder."\n";
            $data .= 'ACTION:DISPLAY'."\n";
            $data .= 'DESCRIPTION:Reminder'."\n";
            $data .= 'END:VALARM'."\n";
        }

        $data .= 'END:VEVENT' . "\n";
        $data .= 'END:VCALENDAR' . "\n";

        return self::generate()->setData($data);

    }

    public static function upi(string $upiId, int|float $amount = null,  string $name = null, string $description = null, string $currency = 'INR')
    {
        $data = 'upi://pay?pa=' . $upiId;

        if ($amount) {
            $data .= '&am=' . $amount;
        }

        if ($name) {
            $data .= '&pn=' . $name;
        }

        if ($description) {
            $data .= '&tn=' . $description;
        }

        if ($currency) {
            $data .= '&cu=' . $currency;
        }

        return self::generate()->setData($data);
    }

}
