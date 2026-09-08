<?php

namespace App\Http\Middleware;

use Illuminate\Cookie\Middleware\EncryptCookies as Middleware;

class EncryptCookies extends Middleware
{
    /**
     * The names of the cookies that should not be encrypted.
     *
     * @var array
     */
    protected $except = [
        // Written by the Meetings page from JS (it is the browser that knows
        // how many rows fit) and read back on the next cold load to size the
        // first page. An encrypted cookie can't be set client-side, and there
        // is nothing sensitive in a row count.
        'hibarr_meetings_per_page_hint',
        // Same reason: the browser owns whether the "next up" cards show, and
        // the list query has to know, because it leaves their meetings out.
        'hibarr_meetings_next_up',
    ];
}
