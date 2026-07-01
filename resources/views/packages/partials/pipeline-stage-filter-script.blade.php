<script>
    (function () {
        var pipelineSelect = $('#pipeline_id');
        var stageSelect = $('#default_stage_id');
        var preserveStageOnInit = @json($preserveStageOnInit ?? false);

        function stagePriority(option) {
            return parseInt($(option).attr('data-priority'), 10) || 0;
        }

        function reorderVisibleStageOptions() {
            var placeholder = stageSelect.find('option[value=""]').first().detach();
            var enabledOptions = stageSelect.find('option:not([value=""]):not(:disabled)').detach().get()
                .sort(function (a, b) {
                    return stagePriority(a) - stagePriority(b);
                });
            var disabledOptions = stageSelect.find('option:not([value=""])').detach().get()
                .sort(function (a, b) {
                    return stagePriority(a) - stagePriority(b);
                });

            stageSelect.empty().append(placeholder).append(enabledOptions).append(disabledOptions);
        }

        function filterPackageStages(resetInvalidSelection) {
            var pipelineId = pipelineSelect.val();

            stageSelect.find('option').each(function () {
                var option = $(this);
                var optionPipelineId = option.attr('data-pipeline-id');

                if (option.val() === '') {
                    option.show().prop('disabled', false);
                    return;
                }

                if (!pipelineId) {
                    option.hide().prop('disabled', true);
                    return;
                }

                if (String(optionPipelineId) === String(pipelineId)) {
                    option.show().prop('disabled', false);
                } else {
                    option.hide().prop('disabled', true);
                }
            });

            if (!pipelineId) {
                stageSelect.val('');
                stageSelect.prop('disabled', true);
            } else {
                stageSelect.prop('disabled', false);

                if (resetInvalidSelection) {
                    var selectedOption = stageSelect.find('option:selected');
                    if (selectedOption.val() !== '' && (selectedOption.prop('disabled') || selectedOption.css('display') === 'none')) {
                        stageSelect.val('');
                    }
                }
            }

            reorderVisibleStageOptions();
            stageSelect.selectpicker('refresh');
        }

        pipelineSelect.selectpicker();
        stageSelect.selectpicker();

        pipelineSelect.on('changed.bs.select', function () {
            filterPackageStages(true);
        });

        filterPackageStages(!preserveStageOnInit);
    })();
</script>
