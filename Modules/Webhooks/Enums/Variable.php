<?php

namespace Modules\Webhooks\Enums;

interface Variable
{

    public function key(): string;

    public static function invalidVariables(): array;

}

