pipeline {
    agent any

    options {
        skipDefaultCheckout()
    }

    stages {
        stage('Identify Environment') {
            steps {
                script {
                    
                    if (env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'master') {
                        env.ENV_NAME   = "production"
                        env.SSH_CREDS  = "PRODUCTION_SSH_PRIVATE_KEY"
                        env.HOST_URL   = credentials('PRODUCTION_HOST')
                        env.USER_NAME  = credentials('PRODUCTION_USER')
                        env.SSH_PORT   = "22" 
                        env.LIVE_LINK  = "/var/www/html"
                    } else {
                        env.ENV_NAME   = "staging"
                        env.SSH_CREDS  = "STAGIN_SSH_PRIVATE_KEY"
                        env.HOST_URL   = credentials('STAGING_HOST')
                        env.USER_NAME  = credentials('STAGING_USER')
                        env.SSH_PORT   = "2244"
                        // This is of the assumption that hibarr-crm-staging is the webroot for staging, which it currently is, as at the time of writing., but should be adjusted if changed later.
                        env.LIVE_LINK  = "/home/${env.USER_NAME}/hibarr-crm-staging"
                    }
                }
            }
        }

        stage('Remote Atomic Build & Deploy') {
            when {
                beforeAgent true
                allOf {
                    not { changeRequest() }
                    anyOf { branch 'main'; branch 'master'; branch 'staging'; branch 'develop' }
                }
            }
            steps {
                withCredentials([sshUserPrivateKey(credentialsId: env.SSH_CREDS, keyFileVariable: 'SSH_KEY_FILE')]) {
                    sh """
                        # Use \\$ to tell Jenkins 'This is a shell variable, don't touch it'
                        chmod 400 \$SSH_KEY_FILE
                        
                        # Use \${env.NAME} for Jenkins variables
                        BUILD_PATH="~/deployments/${env.ENV_NAME}_build_${env.BUILD_ID}"

                        ssh -i \$SSH_KEY_FILE -p ${env.SSH_PORT} -o StrictHostKeyChecking=no ${env.USER_NAME}@${env.HOST_URL} "
                            echo 'Starting Atomic Build for ${env.ENV_NAME}...'
                            
                            # 1. Prepare directory (Use \\$ here because it's inside the SSH string)
                            mkdir -p \$BUILD_PATH
                            cd \$BUILD_PATH

                            # 2. Clone the specific branch
                            git clone --depth 1 --branch ${env.BRANCH_NAME} https://github.com/HIBARR-Estates/hibarr-crm.git .

                            # 3. Build inside this folder
                            if [ ! -f composer.phar ]; then curl -sS https://getcomposer.org/installer | php; fi
                            php composer.phar install --no-interaction --prefer-dist --optimize-autoloader
                            
                            npm install
                            touch .env
                            php artisan ziggy:generate
                            npm run production

                            # 4. Link the shared .env and persistent storage
                            ln -sfn ~/shared/.env \$BUILD_PATH/.env
                            
                            mkdir -p \$BUILD_PATH/public/user-uploads
                            ln -sfn ~/shared/user-uploads \$BUILD_PATH/public/user-uploads

                            # 5. Finalize (Migrations, etc.)
                            make finalize-deploy

                            # 6. THE ATOMIC SWITCH
                            ln -sfn \$BUILD_PATH ${env.LIVE_LINK}
                            
                            echo 'Deployment to ${env.ENV_NAME} successful!'

                            # 7. Cleanup old builds
                            cd ~/deployments && ls -t | grep ${env.ENV_NAME}_build | tail -n +6 | xargs rm -rf 2>/dev/null || true
                        "
                    """
                }
            }
        }
    }
}