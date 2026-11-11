<?php

namespace App\Support;

use RuntimeException;

/**
 * A Keycloak back-channel logout token failed validation (answered with 400).
 */
class InvalidLogoutToken extends RuntimeException
{
}
