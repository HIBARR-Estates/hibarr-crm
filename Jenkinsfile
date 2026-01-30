pipeline {
    agent any

    options {
        skipDefaultCheckout()
    }

    environment {
        ENV_NAME = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? 'production' : 'staging'}"
        SSH_PORT = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? '22' : '2244'}"
        SSH_CREDS = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? 'PRODUCTION_SSH_PRIVATE_KEY' : 'STAGIN_SSH_PRIVATE_KEY'}"
    }

    stages {
        stage('Identify Target') {
            steps {
                script {
                    def hostCredId = (env.ENV_NAME == 'production') ? 'PRODUCTION_HOST' : 'STAGING_HOST'
                    def userCredId = (env.ENV_NAME == 'production') ? 'PRODUCTION_USER' : 'STAGING_USER'
                    
                    withCredentials([
                        string(credentialsId: hostCredId, variable: 'HOST_STR'),
                        string(credentialsId: userCredId, variable: 'USER_STR')
                    ]) {
                        env.TARGET_HOST = HOST_STR
                        env.TARGET_USER = USER_STR
                    }
                    
                    env.LIVE_LINK = (env.ENV_NAME == 'production') ? "/home/${env.TARGET_USER}/hibarr-crm" : "/home/${env.TARGET_USER}/hibarr-crm-staging"
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
                    sh '''
                        chmod 400 $SSH_KEY_FILE
                        BUILD_PATH="~/deployments/${ENV_NAME}_build_${BUILD_ID}"

                        ssh -i $SSH_KEY_FILE -p $SSH_PORT -o StrictHostKeyChecking=no $TARGET_USER@$TARGET_HOST "
                            set -e
                            echo 'Starting Atomic Build for $ENV_NAME...'
                            
                            mkdir -p $BUILD_PATH
                            cd $BUILD_PATH

                            git clone --depth 1 --branch $BRANCH_NAME https://github.com/HIBARR-Estates/hibarr-crm.git .

                            # --- FIX: Ensure Laravel directories exist and are writable ---
                            mkdir -p bootstrap/cache storage/framework/cache storage/framework/sessions storage/framework/views storage/logs
                            chmod -R 775 bootstrap/cache storage
                            
                            # Create a temporary .env so artisan commands don't fail during install
                            if [ -f ~/shared/.env ]; then
                                cp ~/shared/.env .env
                            else
                                touch .env
                            fi

                            # Install Composer dependencies
                            if [ ! -f composer.phar ]; then curl -sS https://getcomposer.org/installer | php; fi
                            php composer.phar install --no-interaction --prefer-dist --optimize-autoloader
                            
                            # Frontend Build
                            npm install
                            php artisan ziggy:generate
                            npm run production

                            # Finalize links
                            ln -sfn ~/shared/.env $BUILD_PATH/.env
                            mkdir -p $BUILD_PATH/public/user-uploads
                            ln -sfn ~/shared/user-uploads $BUILD_PATH/public/user-uploads

                            make finalize-deploy

                            # THE ATOMIC SWITCH
                            ln -sfn $BUILD_PATH $LIVE_LINK
                            
                            echo 'Deployment successful!'

                            # Cleanup old builds
                            cd ~/deployments && ls -t | grep ${ENV_NAME}_build | tail -n +6 | xargs rm -rf 2>/dev/null || true
                        "
                    '''
                }
            }
        }
    }
}
