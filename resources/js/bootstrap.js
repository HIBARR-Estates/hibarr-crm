window._ = require('lodash');

/**
 * We'll load the axios HTTP library which allows us to easily issue requests
 * to our Laravel back-end. This library automatically handles sending the
 * CSRF token as a header based on the value of the "XSRF" token cookie.
 */

window.axios = require('axios');

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

/**
 * Echo exposes an expressive API for subscribing to channels and listening
 * for events that are broadcast by Laravel. Echo and event broadcasting
 * allows your team to easily build robust real-time web applications.
 */

import Echo from 'laravel-echo';

window.Pusher = require('pusher-js');

// An empty key throws inside Pusher and aborts this bundle. Docker builds
// have no MIX_PUSHER_* at image build time, so the throw used to skip every
// script concatenated after this file: selects, Dropzone, form submits.
window.startEcho = function (options) {
    if (window.Echo || !options || !options.key) {
        return window.Echo || null;
    }

    window.Echo = new Echo(Object.assign({
        broadcaster: 'pusher',
        forceTLS: true,
    }, options));

    return window.Echo;
};

if (process.env.MIX_PUSHER_APP_KEY) {
    window.startEcho({
        key: process.env.MIX_PUSHER_APP_KEY,
        cluster: process.env.MIX_PUSHER_APP_CLUSTER,
    });
}
