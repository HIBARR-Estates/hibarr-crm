<!-- TAB CONTENT START -->
<div class="tab-pane fade show active" role="tabpanel" aria-labelledby="nav-marketing-tab">

    <div class="p-20">
        <x-cards.data :title="__('Marketing Information')" class="mb-3">
            @if($deal->contact && $deal->contact->marketing)
                <div class="row mx-0">
                    {{-- UTM Parameters Section --}}
                    <div class="col-12 px-0 mb-3">
                        <h5 class="f-16 f-w-500 mb-3 text-capitalize">
                            <i class="fa fa-bullseye mr-2"></i>UTM & Campaign Tracking
                        </h5>
                    </div>

                    <x-cards.data-row 
                        :label="__('UTM Source')" 
                        :value="$deal->contact->marketing->utm_source ?? '--'" 
                    />

                    <x-cards.data-row 
                        :label="__('UTM Medium')" 
                        :value="$deal->contact->marketing->utm_medium ?? '--'" 
                    />

                    <x-cards.data-row 
                        :label="__('UTM Campaign')" 
                        :value="$deal->contact->marketing->utm_campaign ?? '--'" 
                    />

                    <x-cards.data-row 
                        :label="__('UTM Term')" 
                        :value="$deal->contact->marketing->utm_term ?? '--'" 
                    />

                    <x-cards.data-row 
                        :label="__('UTM Content')" 
                        :value="$deal->contact->marketing->utm_content ?? '--'" 
                    />

                    <x-cards.data-row 
                        :label="__('UTM Audience')" 
                        :value="$deal->contact->marketing->utm_audience ?? '--'" 
                    />

                    {{-- Traffic Source Section --}}
                    <div class="col-12 px-0 mb-3 mt-3">
                        <h5 class="f-16 f-w-500 mb-3 text-capitalize">
                            <i class="fa fa-chart-line mr-2"></i>@lang('marketing.traffic_source')
                        </h5>
                    </div>

                    <x-cards.data-row 
                        :label="__('Traffic Source ID')" 
                        :value="$deal->contact->marketing->traffic_source_id ?? '--'" 
                    />

                    {{-- Social Media Tracking Section --}}
                    <div class="col-12 px-0 mb-3 mt-3">
                        <h5 class="f-16 f-w-500 mb-3 text-capitalize">
                            <i class="fab fa-facebook mr-2"></i>@lang('marketing.social_media_tracking')
                        </h5>
                    </div>

                    <x-cards.data-row 
                        :label="__('modules.marketing.facebook_click_id')" 
                        :value="$deal->contact->marketing->facebook_click_id ?? '--'" 
                    />

                    <x-cards.data-row 
                        :label="__('modules.marketing.facebook_lead_id')" 
                        :value="$deal->contact->marketing->facebook_lead_id ?? '--'" 
                    />

                    <x-cards.data-row 
                        :label="__('Facebook Browser ID')" 
                        :value="$deal->contact->marketing->facebook_browser_id ?? '--'" 
                    />

                    <x-cards.data-row 
                        :label="__('IP Address')" 
                        :value="$deal->contact->marketing->ip_address ?? '--'" 
                    />

                    <x-cards.data-row 
                        :label="__('User Agent')" 
                        :value="$deal->contact->marketing->user_agent ?? '--'" 
                    />

                    {{-- Engagement Tracking Section --}}
                    <div class="col-12 px-0 mb-3 mt-3">
                        <h5 class="f-16 f-w-500 mb-3 text-capitalize">
                            <i class="fa fa-users mr-2"></i>@lang('marketing.engagement_tracking')
                        </h5>
                    </div>

                    <div class="col-6 px-0 pb-3 d-flex">
                        <p class="mb-0 text-lightest f-14 w-30 d-inline-block">{{ __('modules.marketing.registered_for_webinar') }}</p>
                        <p class="mb-0 text-dark-grey f-14">
                            @if($deal->contact->marketing->has_registered_for_the_webinar)
                                <x-status color="green" :value="__('modules.marketing.yes')" />
                            @else
                                <x-status color="red" :value="__('modules.marketing.no')" />
                            @endif
                        </p>
                    </div>

                    <div class="col-6 px-0 pb-3 d-flex">
                        <p class="mb-0 text-lightest f-14 w-30 d-inline-block">{{ __('modules.marketing.joined_facebook_group') }}</p>
                        <p class="mb-0 text-dark-grey f-14">
                            @if($deal->contact->marketing->has_joined_the_facebook_group)
                                <x-status color="green" :value="__('modules.marketing.yes')" />
                            @else
                                <x-status color="red" :value="__('modules.marketing.no')" />
                            @endif
                        </p>
                    </div>

                    <div class="col-6 px-0 pb-3 d-flex">
                        <p class="mb-0 text-lightest f-14 w-30 d-inline-block">{{ __('modules.marketing.downloaded_ebook') }}</p>
                        <p class="mb-0 text-dark-grey f-14">
                            @if($deal->contact->marketing->has_downloaded_the_ebook)
                                <x-status color="green" :value="__('modules.marketing.yes')" />
                            @else
                                <x-status color="red" :value="__('modules.marketing.no')" />
                            @endif
                        </p>
                    </div>

                    <div class="col-6 px-0 pb-3 d-flex">
                        <p class="mb-0 text-lightest f-14 w-30 d-inline-block">{{ __('modules.marketing.registered_for_zoom_meeting') }}</p>
                        <p class="mb-0 text-dark-grey f-14">
                            @if($deal->contact->marketing->registered_for_zoom_meeting)
                                <x-status color="green" :value="__('modules.marketing.yes')" />
                            @else
                                <x-status color="red" :value="__('modules.marketing.no')" />
                            @endif
                        </p>
                    </div>
             
                    {{-- Created/Updated Info --}}
                    <div class="col-12 px-0 mt-3 pt-3 border-top">
                        <div class="row">
                            <div class="col-6 px-0 pb-3 d-flex">
                                <p class="mb-0 text-lightest f-14 w-30 d-inline-block">{{ __('modules.marketing.created_at') }}</p>
                                <p class="mb-0 text-dark-grey f-14">
                                    {{ $deal->contact->marketing->created_at ? $deal->contact->marketing->created_at->timezone(company()->timezone)->format(company()->date_format . ' ' . company()->time_format) : '--' }}
                                </p>
                            </div>
                            <div class="col-6 px-0 pb-3 d-flex">
                                <p class="mb-0 text-lightest f-14 w-30 d-inline-block">{{ __('modules.marketing.updated_at') }}</p>
                                <p class="mb-0 text-dark-grey f-14">
                                    {{ $deal->contact->marketing->updated_at ? $deal->contact->marketing->updated_at->timezone(company()->timezone)->format(company()->date_format . ' ' . company()->time_format) : '--' }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            @else
                <x-cards.no-record 
                    icon="chart-bar" 
                    :message="__('No marketing information available for this lead.')" 
                />
            @endif
        </x-cards.data>
    </div>

</div>
<!-- TAB CONTENT END -->