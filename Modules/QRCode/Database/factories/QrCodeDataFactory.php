<?php

namespace Modules\QRCode\Database\factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;
use Modules\QRCode\Enums\Type;
use Modules\QRCode\Support\QrCode;

class QrCodeDataFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     */
    protected $model = \Modules\QRCode\Entities\QrCodeData::class;

    /**
     * Define the model's default state.
     */
    public function definition(): array
    {

        return [
            'title' => $this->faker->sentence,
            'size' => 600,
            'margin' => 10,
            'foreground_color' => $this->faker->hexColor,
            'background_color' => '#ffffff',
            'logo_size' => 100,
//            'logo' => $this->faker->randomElement([
//                null, // no logo
//                'https://demo.worksuite.biz/img/worksuite-logo.png',
//            ]),
            'type' => $this->faker->randomElement([
                Type::email->value,
                Type::event->value,
                Type::geo->value,
                Type::skype->value,
                Type::sms->value,
                Type::tel->value,
                Type::text->value,
                Type::url->value,
                Type::whatsapp->value,
                Type::wifi->value,
            ]),
            'data' => $this->faker->sentence,
        ];
    }

    public function data(): Factory
    {
        return $this->state(function (array $attributes) {
            return $this->generateData($attributes);
        });

    }

    private function generateData($attributes)
    {
        return match (Type::tryFrom($attributes['type'])) {
            Type::email => $this->qrEmail(),
            Type::event => $this->qrEvent(),
            Type::geo => $this->qrGeo(),
            Type::skype => $this->qrSkype(),
            Type::sms => $this->qrSms(),
            Type::tel => $this->qrTel(),
            Type::text => $this->qrText(),
            Type::url => $this->qrUrl(),
            Type::whatsapp => $this->qrWhatsapp(),
            Type::wifi => $this->qrWifi(),
            default => $this->qrText(),
        };
    }

    private function qrEmail()
    {
        $email = $this->faker->email;
        $subject = $this->faker->sentence;
        $message = $this->faker->text;

        return [
            'data' => QrCode::email($email, $subject, $message)->getData(),
            'form_data' => [
                'email' => $email,
                'subject' => $subject,
                'message' => $message,
            ],
        ];
    }

    private function qrEvent()
    {
        $startDateTime = Carbon::createFromFormat('Y-m-d H:i:s', $this->faker->dateTime->format('Y-m-d H:i:s'));

        $endDateTime = Carbon::createFromFormat('Y-m-d H:i:s', $this->faker->dateTime->format('Y-m-d H:i:s'));
        $address = $this->faker->address;
        $title = $this->faker->sentence;

        return [
            'data' => QrCode::event($title, $startDateTime, $endDateTime, $address)->getData(),
            'form_data' => [
                'title' => $title,
                'location' => $address,
                'start_date' => $startDateTime->format('Y-m-d'),
                'start_time' => $startDateTime->format('H:i'),
                'end_date' => $endDateTime->format('Y-m-d'),
                'end_time' => $endDateTime->format('H:i'),
            ],
        ];
    }

    private function qrGeo()
    {
        $latitude = $this->faker->latitude;
        $longitude = $this->faker->longitude;

        return [
            'data' => QrCode::geo($latitude, $longitude)->getData(),
            'form_data' => [
                'latitude' => $latitude,
                'longitude' => $longitude,
            ],
        ];
    }

    private function qrSkype()
    {
        $username = $this->faker->userName;
        $type = $this->faker->randomElement(['call', 'chat']);

        return [
            'data' => QrCode::skype($username, $type)->getData(),
            'form_data' => [
                'username' => $username,
                'skypeContactType' => $type,
            ],
        ];
    }

    private function qrSms()
    {
        $mobile = $this->faker->phoneNumber;
        $countryPhoneCode = $this->faker->randomElement([91, 1, 44, 52, 43, 60, 41]);
        $message = $this->faker->text;

        return [
            'data' => QrCode::sms($mobile, $countryPhoneCode, $message)->getData(),
            'form_data' => [
                'mobile' => $mobile,
                'country_phonecode' => $countryPhoneCode,
                'message' => $message,
            ],
        ];
    }

    private function qrTel()
    {
        $mobile = $this->faker->phoneNumber;
        $countryPhoneCode = $this->faker->randomElement([91, 1, 44, 52, 43, 60, 41]);

        return [
            'data' => QrCode::tel($mobile, $countryPhoneCode)->getData(),
            'form_data' => [
                'mobile' => $mobile,
                'country_phonecode' => $countryPhoneCode,
            ],
        ];
    }

    private function qrText()
    {
        $message = $this->faker->sentence;

        return [
            'data' => QrCode::text($message)->getData(),
            'form_data' => [
                'message' => $message,
            ],
        ];
    }

    private function qrUrl()
    {
        $url = $this->faker->url;

        return [
            'data' => QrCode::url($url)->getData(),
            'form_data' => [
                'url' => $url,
            ],
        ];
    }

    private function qrWhatsapp()
    {
        $mobile = $this->faker->phoneNumber;
        $countryPhoneCode = $this->faker->randomElement([91, 1, 44, 52, 43, 60, 41]);
        $message = $this->faker->text;

        return [
            'data' => QrCode::whatsapp($mobile, $countryPhoneCode, $message)->getData(),
            'form_data' => [
                'mobile' => $mobile,
                'country_phonecode' => $countryPhoneCode,
                'message' => $message,
            ],
        ];
    }

    private function qrWifi()
    {
        $name = $this->faker->word;
        $password = $this->faker->password;
        $encryption = $this->faker->randomElement(['WPA', 'WEP', null]);
        $hidden = $this->faker->randomElement([1, 0]);

        return [
            'data' => QrCode::wifi($name, $password, $encryption, $hidden)->getData(),
            'form_data' => [
                'name' => $name,
                'password' => $password,
                'encryption' => $encryption,
                'hidden' => $hidden,
            ],
        ];
    }

}

