<?php

namespace Database\Factories;

use App\Models\User;
use App\Support\DemoSeeding;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class UserFactory extends Factory
{

    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = User::class;

    /**
     * Define the model's default state.
     *
     * @return array
     */
    public function definition()
    {
        return [
            'name' => fake()->name,
            'email' => fake()->unique()->safeEmail . rand(0, 9), /* @phpstan-ignore-line */
            'password' => bcrypt(DemoSeeding::password()),
            'gender' => 'male',
            'remember_token' => Str::random(10),
        ];
    }

}
