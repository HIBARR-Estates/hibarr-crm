<style>
    .discussion-point-box {
        border: 1px solid #e0e0e0;
        background-color: #f9f9f9;
        transition: box-shadow 0.3s ease;
    }

    .discussion-point-box:hover {
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .discussion-content {
        font-size: 16px;
        line-height: 1.6;
        color: #333;
    }
</style>

<div class="modal-header">
    <h5 class="modal-title"><i class="fas fa-comment-alt mr-2"></i> @lang('performance::app.discussionPoint')</h4>
    </h5>
    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
</div>

<div class="modal-body">
    <div class="portlet-body"></div>
    <div class="row">
        <div class="col-md-12">
            <div class="discussion-point-box p-3 bg-light rounded shadow-sm">
                <div class="discussion-content">
                    {!! $action->action_point !!}
                </div>
            </div>
        </div>
    </div>
</div>
<div class="modal-footer">
    <x-forms.button-cancel data-dismiss="modal" class="border-0 mr-3">@lang('app.close')</x-forms.button-cancel>
</div>
