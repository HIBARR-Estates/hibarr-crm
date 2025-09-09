
<div class="row">
    <div class="col-md-12 mt-3 mb-3">
        <label class="f-14 text-dark-grey w-100" for="usr">@lang('biolinks::app.verifiedBadge')</label>
        <ul class="module-list list-unstyled">
            @foreach (\Modules\Biolinks\Enums\VerifiedBadge::cases() as $badge)
                <li>
                    <input type="radio" @checked($biolinkSettings->verified_badge == $badge) id="verified_badge_{{ $badge->value }}"
                        value="{{ $badge->value }}" name="verified_badge" class="verified_badge"/>
                    <label class="btn" for="verified_badge_{{ $badge->value }}"> {{ $badge->label() }} </label>
                </li>
            @endforeach
        </ul>
    </div>
</div>
