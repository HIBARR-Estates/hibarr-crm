<?php

namespace App\Actions\Fortify;

use Illuminate\Validation\Rules\Password;

trait PasswordValidationRules
{

    /**
     * Get the validation rules used to validate passwords.
     *
     * @return array
     */

    protected function passwordRules()
    {
        // Policy defined in AppServiceProvider::boot().
        return ['required', 'string', Password::defaults(), 'confirmed'];
    }

}
