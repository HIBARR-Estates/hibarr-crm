<div class="row">
    <div class="col-xl-3 col-lg-6 col-md-6 mb-3">
        <a href="javascript:;" class="toObjectives" data-status="">
            <x-cards.widget :title="__('performance::app.totalObjectives')" value="{{ $total }}" icon="bars"
            widgetId="totalExpense" />
        </a>
    </div>

    <div class="col-xl-3 col-lg-6 col-md-6 mb-3">
        <a href="javascript:;" class="toObjectives" data-status="onTrack">
            <x-cards.widget :title="__('performance::app.onTrack')" value="{{ $onTrack }}" icon="check-circle"
        widgetId="totalExpense" />
        </a>
    </div>

    <div class="col-xl-3 col-lg-6 col-md-6 mb-3">
        <a href="javascript:;" class="toObjectives" data-status="offTrack">
            <x-cards.widget :title="__('performance::app.offTrack')" value="{{ $offTrack }}" icon="arrow-circle-down"
        widgetId="totalExpense" />
        </a>
    </div>

    <div class="col-xl-3 col-lg-6 col-md-6 mb-3">
        <a href="javascript:;" class="toObjectives" data-status="atRisk">
            <x-cards.widget :title="__('performance::app.atRisk')" value="{{ $atRisk }}" icon="exclamation-circle" widgetId="totalExpense" />
        </a>
    </div>

    <div class="col-xl-3 col-lg-6 col-md-6 mb-3">
        <a href="javascript:;" class="toObjectives" data-status="completed">
            <x-cards.widget :title="__('performance::app.completed')" value="{{ $completed }}" icon="check" widgetId="totalExpense" />
        </a>
    </div>
</div>
