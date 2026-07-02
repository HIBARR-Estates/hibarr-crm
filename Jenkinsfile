pipeline {
    agent any
    options { skipDefaultCheckout() }

    environment {
        ENV_NAME = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? 'production' : 'staging'}"
        SSH_PORT = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? '22' : '2244'}"
        SSH_CREDS = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? 'PRODUCTION_SSH_PRIVATE_KEY' : 'STAGIN_SSH_PRIVATE_KEY'}"
        INFISICAL_CLI_VERSION = '0.43.78'
        INFISICAL_DOMAIN = 'https://infisical.hibarr.org'
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
                withCredentials([
                    sshUserPrivateKey(credentialsId: env.SSH_CREDS, keyFileVariable: 'SSH_KEY_FILE'),
                    string(credentialsId: 'infisical-service-token', variable: 'INFISICAL_TOKEN')
                ]) {
                    sh '''
                        set -e
                        chmod 400 "$SSH_KEY_FILE"
                        BUILD_PATH="/home/$TARGET_USER/deployments/${ENV_NAME}_build_${BUILD_ID}"
                        INFISICAL_BIN="${WORKSPACE}/.tools/infisical"
                        ENV_FILE_LOCAL="${WORKSPACE}/.env.deploy"
                        REMOTE_ENV_TMP="/tmp/hibarr-crm.env.${BUILD_ID}"

                        echo "Step 0: Bootstrapping Infisical CLI on Jenkins workspace..."
                        mkdir -p "${WORKSPACE}/.tools"
                        if [ ! -x "$INFISICAL_BIN" ]; then
                            ARCH="$(uname -m)"
                            case "$ARCH" in
                                x86_64) INFISICAL_ARCH="amd64" ;;
                                aarch64|arm64) INFISICAL_ARCH="arm64" ;;
                                *)
                                    echo "Unsupported Jenkins agent architecture: $ARCH"
                                    exit 1
                                    ;;
                            esac

                            curl -fsSL -o /tmp/infisical-cli.tar.gz \
                                "https://github.com/Infisical/cli/releases/download/v${INFISICAL_CLI_VERSION}/cli_${INFISICAL_CLI_VERSION}_linux_${INFISICAL_ARCH}.tar.gz"
                            tar -xzf /tmp/infisical-cli.tar.gz -C "${WORKSPACE}/.tools"
                            chmod +x "$INFISICAL_BIN"
                            rm -f /tmp/infisical-cli.tar.gz
                        fi
                        "$INFISICAL_BIN" --version

                        echo "Step 0b: Exporting secrets from Infisical (${ENV_NAME})..."
                        export INFISICAL_TOKEN
                        export INFISICAL_DOMAIN
                        export INFISICAL_API_URL="$INFISICAL_DOMAIN"
                        echo "Using Infisical domain: $INFISICAL_DOMAIN"
                        "$INFISICAL_BIN" export \
                            --env="$ENV_NAME" \
                            --domain="$INFISICAL_DOMAIN" \
                            --format=dotenv \
                            --output-file="$ENV_FILE_LOCAL"

                        echo "Step 0c: Transferring .env to target server..."
                        scp -i "$SSH_KEY_FILE" -P "$SSH_PORT" -o StrictHostKeyChecking=no \
                            "$ENV_FILE_LOCAL" "$TARGET_USER@$TARGET_HOST:$REMOTE_ENV_TMP"
                        rm -f "$ENV_FILE_LOCAL"

                        ssh -i $SSH_KEY_FILE -p $SSH_PORT -o StrictHostKeyChecking=no $TARGET_USER@$TARGET_HOST "
                            set -e

                            echo 'Step 0d: Backing up shared .env (rollback safety)...'
                            cp -f /home/$TARGET_USER/shared/.env /home/$TARGET_USER/shared/.env.bak 2>/dev/null || true
                            
                            echo 'Step 1: Cloning and Building...'
                            mkdir -p $BUILD_PATH
                            cd $BUILD_PATH
                            git clone --depth 1 --branch $BRANCH_NAME https://github.com/HIBARR-Estates/hibarr-crm.git .

                            mv $REMOTE_ENV_TMP $BUILD_PATH/.env

                            # --- Stationary File Fix ---
                            mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
                            chmod -R 775 bootstrap/cache storage
                            # ----------------------------

                            # Run Build via Makefile
                            make build-artifact
                            
                            echo 'Step 1b: gRPC binary setup...'
                            # Proto classes already generated in build-artifact (make proto + autoload refresh)
                            # Install RoadRunner binary for Linux
                            make rr-install
                            chmod +x ./rr
                            
                            echo 'Step 2: Linking Shared Assets...'
                            mv $BUILD_PATH/.env /home/$TARGET_USER/shared/.env
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
                                
                                # Wait for workers to allocate, then verify health
                                sleep 5
                                if curl -sf http://127.0.0.1:2114/health > /dev/null 2>&1; then
                                    echo 'gRPC health check: PASSED'
                                else
                                    echo 'WARNING: gRPC health check failed. Check: journalctl -u roadrunner-grpc -n 50'
                                fi
                            else
                                echo 'WARNING: roadrunner-grpc service not found.'
                                echo 'Run once: sudo bash ${LIVE_LINK}/scripts/setup-grpc-staging.sh YOUR_GRPC_DOMAIN'
                            fi

                            echo 'Step 8: Restart queue workers (required for atomic deploys)...'
                            # queue:restart only signals graceful exit; supervisor ensures workers
                            # pick up the new release path immediately.
                            if [ "$ENV_NAME" = "production" ]; then
                                sudo supervisorctl restart hibarr_crm:* hibarr_crm_expose:* || true
                            else
                                sudo supervisorctl restart hibarr_crm_staging:* hibarr_crm_staging_expose:* || true
                            fi

                            echo 'Step 9: Cleanup old deployments...'
                            cd /home/$TARGET_USER/deployments
                            ls -dt ${ENV_NAME}_build_* | tail -n +6 | xargs rm -rf || true

                            echo 'Deployment Successful!'
                        "
                    '''
                }
            }
        }
    }
}
