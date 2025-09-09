<div class="row">
    <div class="col-sm-12">
        <x-form id="save-asset-form">
            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                    @lang('biolinks::app.addANewBlock')</h4>
                <div class="row p-20">
                    <div class="col-md-12">
                        <div class="row">
                            <div class="col-md-12">
                                <x-alert type="info" icon="info-circle">
                                    @lang('biolinks::app.standardBlocks')
                                </x-alert>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="link" icon="link"
                                data-toggle="popover" data-placement="top" data-content="Link to any external web pages with ease." data-html="true" data-trigger="hover">@lang('app.link')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="heading" icon="heading"
                                data-toggle="popover" data-placement="top" data-content="A heading section will allow you to separate your page content." data-html="true" data-trigger="hover">@lang('validation.attributes.heading')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="paragraph" icon="paragraph"
                                data-toggle="popover" data-placement="top" data-content="A block of simple text." data-html="true" data-trigger="hover">@lang('biolinks::app.paragraph')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="avatar" icon="user"
                                data-toggle="popover" data-placement="top" data-content="An image with different styles to act like your page avatar." data-html="true" data-trigger="hover">@lang('biolinks::app.avatar')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="image" icon="image"
                                data-toggle="popover" data-placement="top" data-content="A simple & good looking image block for your page." data-html="true" data-trigger="hover">@lang('validation.attributes.image')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="socials" icon="users"
                                data-toggle="popover" data-placement="top" data-content="A collection of social media links with their respective icons." data-html="true" data-trigger="hover">@lang('biolinks::app.socials')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-12">
                                <x-alert type="info" icon="info-circle">
                                    @lang('biolinks::app.advancedBlocks')
                                </x-alert>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="email-collector" icon="envelope"
                                data-toggle="popover" data-placement="top" data-content="Easily capture emails from your visitors." data-html="true" data-trigger="hover">@lang('biolinks::app.emailCollector')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="phone-collector" icon="phone"
                                data-toggle="popover" data-placement="top" data-content="Capture phone numbers with ease from your visitors." data-html="true" data-trigger="hover">@lang('biolinks::app.phoneCollector')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-12">
                                <x-alert type="info" icon="info-circle">
                                    @lang('biolinks::app.paymentBlocks')
                                </x-alert>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="paypal"
                                data-toggle="popover" data-placement="top" data-content="Redirect your users to pay via PayPal for a custom product." data-html="true" data-trigger="hover"><i class="fab fa-paypal mr-2"></i>@lang('app.paypal')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-12">
                                <x-alert type="info" icon="info-circle">
                                    @lang('biolinks::app.embedsBlocks')
                                </x-alert>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="sound-cloud"
                                data-toggle="popover" data-placement="top" data-content="Display a Soundcloud player widget on your page with ease." data-html="true" data-trigger="hover"><i class="fab fa-soundcloud mr-2"></i>@lang('biolinks::app.soundCloud')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="spotify"
                                data-toggle="popover" data-placement="top" data-content="Display a Spotify song, album, show or episode widget on your page with ease." data-html="true" data-trigger="hover"><i class="fab fa-spotify mr-2"></i>@lang('biolinks::app.spotify')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="youtube"
                                data-toggle="popover" data-placement="top" data-content="Display a YouTube video on your page with ease." data-html="true" data-trigger="hover"><i class="fab fa-youtube mr-2"></i>@lang('biolinks::app.youtube')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="threads"
                                data-toggle="popover" data-placement="top" data-content="Seamlessly integrate threads for dynamic content interaction. Explore now!" data-html="true" data-trigger="hover">
                                <svg fill="currentColor" height="14" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M331.5 235.7c2.2 .9 4.2 1.9 6.3 2.8c29.2 14.1 50.6 35.2 61.8 61.4c15.7 36.5 17.2 95.8-30.3 143.2c-36.2 36.2-80.3 52.5-142.6 53h-.3c-70.2-.5-124.1-24.1-160.4-70.2c-32.3-41-48.9-98.1-49.5-169.6V256v-.2C17 184.3 33.6 127.2 65.9 86.2C102.2 40.1 156.2 16.5 226.4 16h.3c70.3 .5 124.9 24 162.3 69.9c18.4 22.7 32 50 40.6 81.7l-40.4 10.8c-7.1-25.8-17.8-47.8-32.2-65.4c-29.2-35.8-73-54.2-130.5-54.6c-57 .5-100.1 18.8-128.2 54.4C72.1 146.1 58.5 194.3 58 256c.5 61.7 14.1 109.9 40.3 143.3c28 35.6 71.2 53.9 128.2 54.4c51.4-.4 85.4-12.6 113.7-40.9c32.3-32.2 31.7-71.8 21.4-95.9c-6.1-14.2-17.1-26-31.9-34.9c-3.7 26.9-11.8 48.3-24.7 64.8c-17.1 21.8-41.4 33.6-72.7 35.3c-23.6 1.3-46.3-4.4-63.9-16c-20.8-13.8-33-34.8-34.3-59.3c-2.5-48.3 35.7-83 95.2-86.4c21.1-1.2 40.9-.3 59.2 2.8c-2.4-14.8-7.3-26.6-14.6-35.2c-10-11.7-25.6-17.7-46.2-17.8H227c-16.6 0-39 4.6-53.3 26.3l-34.4-23.6c19.2-29.1 50.3-45.1 87.8-45.1h.8c62.6 .4 99.9 39.5 103.7 107.7l-.2 .2zm-156 68.8c1.3 25.1 28.4 36.8 54.6 35.3c25.6-1.4 54.6-11.4 59.5-73.2c-13.2-2.9-27.8-4.4-43.4-4.4c-4.8 0-9.6 .1-14.4 .4c-42.9 2.4-57.2 23.2-56.2 41.8l-.1 .1z"/></svg>
                                @lang('biolinks::app.threads')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="tiktok"
                                data-toggle="popover" data-placement="top" data-content="Display a TikTok video widget on your page with ease." data-html="true" data-trigger="hover"><i class="fab fa-tiktok mr-2"></i>@lang('biolinks::app.tiktok')
                                </x-forms.button-primary>
                            </div>
                            <div class="col-md-4">
                                <x-forms.button-primary class="mr-3 mb-3 btn-block btn-lg block" id="twitch"
                                data-toggle="popover" data-placement="top" data-content="Display a Twitch account widget on your page with ease." data-html="true" data-trigger="hover"><i class="fab fa-twitch mr-2"></i>@lang('biolinks::app.twitch')
                                </x-forms.button-primary>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="w-100 border-top-grey d-flex justify-content-start px-4 py-3">
                    {{-- <x-forms.button-primary class="mr-3" id="save-asset" icon="check">@lang('app.save')
                    </x-forms.button-primary> --}}

                    <x-forms.button-cancel :link="route('biolinks.edit', $id).'?tab=blocks'" class="border-0">@lang('app.cancel')
                    </x-forms.button-cancel>
                </div>
            </div>
        </x-form>

    </div>
</div>
<script>
    $(document).ready(function () {
        $('.page-heading a[href]').contents().unwrap();

        $('.block').on('click', function(){
            blockId = $(this).attr('id');
            biolinkId = {{ $id }};
            // console.log(blockId, biolinkId);
            let url = "{{ route('biolink-blocks.createBlock', [':biolinkId', ':blockId']) }}";
            url = url.replace(':biolinkId', biolinkId);
            url = url.replace(':blockId', blockId);
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        init(RIGHT_MODAL);
    });
</script>
