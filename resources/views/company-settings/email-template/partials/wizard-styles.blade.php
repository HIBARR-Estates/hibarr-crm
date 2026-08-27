<style>
    .email-template-wizard {
        max-width: 960px;
    }

    .wizard-stepper {
        gap: 0;
    }

    .wizard-stepper .stepper-step {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 0 0 auto;
        cursor: pointer;
        user-select: none;
        min-width: 72px;
    }

    .wizard-stepper .stepper-circle {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 13px;
        border: 2px solid transparent;
        transition: background-color .15s ease, color .15s ease, border-color .15s ease;
    }

    .wizard-stepper .stepper-label {
        font-size: 12px;
        margin-top: 6px;
        white-space: nowrap;
        text-align: center;
    }

    .wizard-stepper .stepper-line {
        flex: 1 1 auto;
        height: 2px;
        margin: 17px 8px 0;
        min-width: 24px;
        transition: background-color .15s ease;
    }

    .wizard-step {
        background: #fff;
        border: 1px solid #e8eef3;
        border-radius: 8px;
        padding: 20px 22px;
    }

    .wizard-step h4 {
        font-size: 16px;
        font-weight: 600;
        color: #28313c;
    }

    .template-mode-card {
        cursor: pointer;
        transition: border-color .15s ease, box-shadow .15s ease;
        background: #fff;
    }

    .template-mode-card:hover {
        border-color: #1d82f5 !important;
    }

    .template-mode-card.border-primary {
        box-shadow: 0 0 0 1px #1d82f5;
    }

    .template-mode-card .custom-control-label {
        cursor: pointer;
    }

    /* Visual (Quill) and HTML Source need to look/behave the same size so
       toggling between them doesn't jump around, and both need to actually
       scroll internally for a long body instead of growing the page. The
       theme's global textarea { overflow: hidden; } and .form-control {
       height: auto; } both fight a fixed-height scrollable textarea — an
       ID selector's specificity is enough to win over those without
       !important, since ID > class > element. */
    #body-editor .ql-editor {
        min-height: 360px;
        max-height: 360px;
        overflow-y: auto;
    }

    #body-html-source {
        height: 360px;
        overflow-y: auto;
        resize: vertical;
    }

    @media (max-width: 767px) {
        .wizard-stepper {
            flex-wrap: wrap;
            justify-content: center;
            row-gap: 12px;
        }

        .wizard-stepper .stepper-line {
            display: none;
        }

        .wizard-step {
            padding: 16px;
        }
    }
</style>
