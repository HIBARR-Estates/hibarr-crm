pipeline {
    agent any

    stages {
        stage('Deploy to Staging') {
            // Only runs if branch is 'staging' OR 'develop' (common for PRs)
            when { 
                anyOf {
                    branch 'staging'
                    branch 'develop'
                }
            }
            environment {
                STAGING_HOST = credentials('STAGING_HOST')
                STAGING_USER = credentials('STAGING_USER')
            }
            steps {
                sshagent(['STAGIN_SSH_PRIVATE_KEY']) {
                    sh """
                        ssh -p 2244 -o StrictHostKeyChecking=no ${STAGING_USER}@${STAGING_HOST} \
                        'cd ~/hibarr-crm-staging && make deploy-staging'
                    """
                }
            }
        }

        stage('Deploy to Production') {
            when { branch 'main' }
            environment {
                PRODUCTION_HOST = credentials('PRODUCTION_HOST')
                PRODUCTION_USER = credentials('PRODUCTION_USER')
            }
            steps {
                sshagent(['PRODUCTION_SSH_PRIVATE_KEY']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no ${PRODUCTION_USER}@${PRODUCTION_HOST} \
                        'cd /var/www/html && git fetch origin && git reset --hard origin/main && make deploy-production'
                    """
                }
            }
        }
    }

    post {
        always {
            // Safety check: Only clean if we actually have a workspace
            script {
                try {
                    cleanWs()
                } catch (Exception e) {
                    echo "Skipping workspace cleanup: No workspace allocated."
                }
            }
        }
        success { echo 'Deployment successful!' }
        failure { echo 'Deployment failed. Check the logs.' }
    }
}