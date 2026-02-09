pipeline {
    agent any
    options { skipDefaultCheckout() }

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
                        BUILD_PATH="/home/$TARGET_USER/deployments/${ENV_NAME}_build_${BUILD_ID}"

                        ssh -i $SSH_KEY_FILE -p $SSH_PORT -o StrictHostKeyChecking=no $TARGET_USER@$TARGET_HOST "
                            set -e
                            
                            echo 'Step 1: Cloning and Building...'
                            mkdir -p $BUILD_PATH
                            cd $BUILD_PATH
                            git clone --depth 1 --branch $BRANCH_NAME https://github.com/HIBARR-Estates/hibarr-crm.git .
                            
                            # Initial environment setup
                            if [ -f ~/shared/.env ]; then cp ~/shared/.env .env; else touch .env; fi

                            # --- Stationary File Fix ---
                            mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
                            chmod -R 775 bootstrap/cache storage
                            # ----------------------------

                            # Run Build via Makefile
                            make build-artifact
                            
                            echo 'Step 1b: gRPC Setup...'                            # Generate PHP classes from Protocol Buffer definitions
                            make proto
                            
                            # Install RoadRunner binary for Linux
                            make rr-install
                            chmod +x ./rr
                            
                            echo 'Step 2: Linking Shared Assets...'
                            # Use absolute paths to ensure the symlink never breaks
                            ln -sfn /home/$TARGET_USER/shared/.env $BUILD_PATH/.env

                            # Create shared folder if it doesn't exist (safety first)
                            mkdir -p /home/$TARGET_USER/shared/user-uploads

                            # Remove the folder Git created so the symlink can take its place
                            rm -rf $BUILD_PATH/public/user-uploads

                            # Create the symlink using the absolute path
                            ln -sfn /home/$TARGET_USER/shared/user-uploads $BUILD_PATH/public/user-uploads

                            echo 'Step 3: Database & Finalization...'
                            make finalize-deploy

                            echo 'Step 4: Atomic Switch...'
                            ln -sfn $BUILD_PATH $LIVE_LINK
                            
                            echo 'Step 5: Permission Guard (The Fix)...'
                            # Force the group to www-data so Nginx can write to logs/cache
                            sudo chown -R $TARGET_USER:www-data $BUILD_PATH/storage $BUILD_PATH/bootstrap/cache || true
                            sudo chmod -R 775 $BUILD_PATH/storage $BUILD_PATH/bootstrap/cache || true
                            
                            echo 'Step 6: Production Optimization...'
                            cd $LIVE_LINK
                            php artisan config:cache
                            php artisan route:cache
                            php artisan view:cache
                            
                            # Reload PHP-FPM to clear OPcache
                            sudo systemctl reload php8.3-fpm || true
                            
                            echo 'Step 7: gRPC Server Restart...'
                            # Restart RoadRunner gRPC server if service exists
                            if systemctl list-units --type=service | grep -q roadrunner-grpc; then
                                sudo systemctl restart roadrunner-grpc || true
                                echo 'RoadRunner gRPC service restarted'
                            else
                                echo 'WARNING: roadrunner-grpc service not found. Please create systemd service.'
                                echo 'See: /etc/systemd/system/roadrunner-grpc.service'
                            fi

                            echo 'Deployment Successful!'
                        "
                    '''
                }
            }
        }
    }
}