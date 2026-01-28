pipeline {
    agent any

    options {
        skipDefaultCheckout()
    }

    // Defining environment here makes them automatically available to all sh scripts
    environment {
        ENV_NAME = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? 'production' : 'staging'}"
        SSH_PORT = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? '22' : '2244'}"
        SSH_CREDS = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? 'PRODUCTION_SSH_PRIVATE_KEY' : 'STAGIN_SSH_PRIVATE_KEY'}"
    }

    stages {
        stage('Identify Target') {
            steps {
                script {
                    // Resolve Host and User strings into the environment
                    def hostCredId = (env.ENV_NAME == 'production') ? 'PRODUCTION_HOST' : 'STAGING_HOST'
                    def userCredId = (env.ENV_NAME == 'production') ? 'PRODUCTION_USER' : 'STAGING_USER'
                    
                    withCredentials([
                        string(credentialsId: hostCredId, variable: 'HOST_STR'),
                        string(credentialsId: userCredId, variable: 'USER_STR')
                    ]) {
                        env.TARGET_HOST = HOST_STR
                        env.TARGET_USER = USER_STR
                    }
                    
                    // Set the link path
                    env.LIVE_LINK = (env.ENV_NAME == 'production') ? "/var/www/html" : "/home/${env.TARGET_USER}/hibarr-crm-staging"
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
                        # Now $TARGET_USER and $TARGET_HOST are guaranteed to be available
                        chmod 400 $SSH_KEY_FILE
                        
                        BUILD_PATH="~/deployments/${ENV_NAME}_build_${BUILD_ID}"

                        echo "Connecting to $TARGET_USER @ $TARGET_HOST on port $SSH_PORT..."

                        ssh -i $SSH_KEY_FILE -p $SSH_PORT -o StrictHostKeyChecking=no $TARGET_USER@$TARGET_HOST "
                            set -e
                            echo 'Starting Atomic Build for $ENV_NAME...'
                            
                            mkdir -p $BUILD_PATH
                            cd $BUILD_PATH

                            git clone --depth 1 --branch $BRANCH_NAME https://github.com/HIBARR-Estates/hibarr-crm.git .

                            if [ ! -f composer.phar ]; then curl -sS https://getcomposer.org/installer | php; fi
                            php composer.phar install --no-interaction --prefer-dist --optimize-autoloader
                            
                            npm install
                            touch .env
                            php artisan ziggy:generate
                            npm run production

                            # Link shared resources
                            ln -sfn ~/shared/.env $BUILD_PATH/.env
                            mkdir -p $BUILD_PATH/public/user-uploads
                            ln -sfn ~/shared/user-uploads $BUILD_PATH/public/user-uploads

                            make finalize-deploy

                            # THE ATOMIC SWITCH
                            ln -sfn $BUILD_PATH $LIVE_LINK
                            
                            echo 'Deployment successful!'

                            # Keep last 5 builds
                            cd ~/deployments && ls -t | grep ${ENV_NAME}_build | tail -n +6 | xargs rm -rf 2>/dev/null || true
                        "
                    '''
                }
            }
        }
    }
}