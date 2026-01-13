pipeline {
    agent any

    environment {
        
        STAGING_HOST    = credentials('STAGING_HOST')
        STAGING_USER    = credentials('STAGING_USER')
        PRODUCTION_HOST = credentials('PRODUCTION_HOST')
        PRODUCTION_USER = credentials('PRODUCTION_USER')
    }

    stages {
        stage('Deploy to Staging') {
            when {
                branch 'staging'
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
            when {
                branch 'main'
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
            cleanWs()
        }
        success {
            echo 'Deployment successful!'
        }
        failure {
            echo 'Deployment failed. Check the logs.'
        }
    }
}