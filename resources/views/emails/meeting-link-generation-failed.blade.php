<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Meeting Link Generation Required</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .content {
            background-color: #fff;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .alert {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }
        .info-box {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
        }
        .btn:hover {
            background-color: #0056b3;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Meeting Link Generation Required</h2>
        <p>Hello {{ $agent_name }},</p>
    </div>

    <div class="content">
        <div class="alert">
            <strong>Action Required:</strong> A meeting link could not be automatically generated for a follow-up in your CRM. Please generate it manually.
        </div>

        <h3>Follow-up Details:</h3>
        <div class="info-box">
            <p><strong>Deal:</strong> {{ $deal_name }}</p>
            <p><strong>Client:</strong> {{ $client_name }}</p>
            <p><strong>Meeting Type:</strong> {{ $meeting_type }}</p>
            <p><strong>Location:</strong> {{ $location }}</p>
            <p><strong>Follow-up Date:</strong> {{ \Carbon\Carbon::parse($follow_up_date)->format('M d, Y \a\t g:i A') }}</p>
        </div>

        <h3>What you need to do:</h3>
        <ol>
            <li>Click the button below to go to the deal in your CRM</li>
            <li>Find the follow-up in the Follow-up tab</li>
            <li>Click "Generate Meeting Link" for this follow-up</li>
            <li>The meeting link will be automatically generated and saved</li>
        </ol>

        <a href="{{ $crm_url }}" class="btn">Go to Deal in CRM</a>

        <p><strong>Note:</strong> This follow-up has been created successfully, but the meeting link needs to be generated manually due to a temporary issue with the automated system.</p>
    </div>

    <div class="footer">
        <p>This is an automated message from your CRM system. Please do not reply to this email.</p>
        <p>If you have any questions, please contact your system administrator.</p>
    </div>
</body>
</html>
