pipeline {
    agent any

    stages {
        stage('Deploy to Staging') {
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
                // This creates a temporary file containing your private key
                withCredentials([sshUserPrivateKey(credentialsId: 'STAGIN_SSH_PRIVATE_KEY', keyFileVariable: 'SSH_KEY_FILE')]) {
                    sh '''
                        chmod 400 $SSH_KEY_FILE
                        ssh -i $SSH_KEY_FILE -p 2244 -o StrictHostKeyChecking=no $STAGING_USER@$STAGING_HOST \
                        "cd ~/hibarr-crm-staging && make deploy-staging"
                    '''
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
                withCredentials([sshUserPrivateKey(credentialsId: 'PRODUCTION_SSH_PRIVATE_KEY', keyFileVariable: 'SSH_KEY_FILE')]) {
                    sh '''
                        chmod 400 $SSH_KEY_FILE
                        ssh -i $SSH_KEY_FILE -o StrictHostKeyChecking=no $PRODUCTION_USER@$PRODUCTION_HOST \
                        'cd /var/www/html && git fetch origin && git reset --hard origin/main && make deploy-production'
                    '''
                }
            }
        }
    }

    post {
        always {
            script {
                try { cleanWs() } catch (e) { echo "Cleanup skipped." }
            }
        }
    }
}