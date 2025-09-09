<div class="row">
    <div class="col-sm-12">
        <div class="card bg-white border-0 b-shadow-4">
            <div class="card-header bg-white  border-bottom-grey  justify-content-between p-20">
                <div class="row">
                    <div class="col-lg-10 col-10">
                        <h3 class="heading-h1">@lang($pageTitle)</h3>
                    </div>
                    <div class="col-lg-2 col-2 text-right">
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-12">
                        <div class="mb-0 f-14 text-wrap ql-editor p-2">{!! nl2br($letter->description) !!}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<script>
    $(document).ready(function() {
        init(RIGHT_MODAL);
    });
</script>
