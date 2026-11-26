pipeline {
    agent any
    options {
        skipDefaultCheckout()
        // One deploy per branch job at a time: overlapping runs would race on the deploy host's shared/.env and the
        // live symlink switch. Per job, so main (production) and develop (staging) still run in parallel.
        disableConcurrentBuilds()
    }

    environment {
        ENV_NAME = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? 'production' : 'staging'}"
    
        INFISICAL_ENV_NAME = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? 'prod' : 'staging'}"
        SSH_PORT = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? '22' : '2244'}"
        SSH_CREDS = "${BRANCH_NAME == 'main' || BRANCH_NAME == 'master' ? 'PRODUCTION_SSH_PRIVATE_KEY' : 'STAGIN_SSH_PRIVATE_KEY'}"
        INFISICAL_CLI_VERSION = '0.43.78'
        // Node used for the Mix build on the Jenkins agent (matches docker/Dockerfile's node:20 assets stage)
        NODE_VERSION = '20.19.5'
        INFISICAL_DOMAIN = 'https://infisical.hibarr.org'
        // Must match workspaceId in .infisical.json (machine identity is org-scoped, not project-scoped)
        INFISICAL_PROJECT_ID = '5f972011-7743-4ff2-aa39-9ee0ac8b14a8'
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

        // The Mix production build needs ~6GB+ of RAM, which the deploy host (7.8GB, no swap, shared with the
        // live app) cannot spare: it was OOM-killed (exit 137) there. So the frontend is built here, on the
        // Jenkins agent, and only the finished assets are shipped to the server.
        stage('Build Frontend Assets') {
            when {
                beforeAgent true
                allOf {
                    not { changeRequest() }
                    anyOf { branch 'main'; branch 'develop' }
                }
            }
            steps {
                withCredentials([
                    string(credentialsId: 'infisical-crm-client-id', variable: 'INFISICAL_CLIENT_ID'),
                    string(credentialsId: 'infisical-crm-client-secret', variable: 'INFISICAL_CLIENT_SECRET')
                ]) {
                    dir('frontend-src') {
                        checkout scm
                    }
                    script {
                        // Pin the deploy host to exactly the commit built here (not whatever the branch tip is by then).
                        env.BUILD_COMMIT = sh(returnStdout: true, script: 'git -C frontend-src rev-parse HEAD').trim()
                    }
                    sh '''
                        set -e
                        SRC="${WORKSPACE}/frontend-src"
                        INFISICAL_BIN="${WORKSPACE}/.tools/infisical"
                        ENV_FILE_LOCAL="${WORKSPACE}/.env.deploy"
                        ASSETS_TGZ="${WORKSPACE}/frontend-assets.tar.gz"

                        echo "Step F1: Memory preflight for the Mix build..."
                        # Mix runs with --max-old-space-size=8192 and Terser/Sass workers on top. If the agent cannot
                        # give it the memory, fail here rather than let the kernel OOM-killer pick a victim (which
                        # could be Jenkins itself).
                        MIN_MB="${FRONTEND_BUILD_MIN_MEM_MB:-6144}"
                        EFFECTIVE_MB="$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)"
                        # A container limit caps what the build can use no matter what the host reports, and memory the
                        # cgroup already uses (Jenkins itself, other builds) is not available to it. Headroom is
                        # limit - usage, plus inactive page cache, which the kernel reclaims before it OOM-kills.
                        cgroup_headroom() {
                            if [ -r "$1" ] && [ -r "$2" ]; then
                                LIMIT_B="$(cat "$1")"
                                case "$LIMIT_B" in
                                    *[!0-9]*|"") return 0 ;;
                                esac
                                USED_B="$(cat "$2")"
                                CACHE_B="$(awk -v k="$4" '$1 == k {print $2}' "$3" 2>/dev/null)"
                                HEADROOM_MB=$(( (LIMIT_B - USED_B + ${CACHE_B:-0}) / 1048576 ))
                                if [ "$HEADROOM_MB" -lt "$EFFECTIVE_MB" ]; then EFFECTIVE_MB="$HEADROOM_MB"; fi
                            fi
                        }
                        cgroup_headroom /sys/fs/cgroup/memory.max /sys/fs/cgroup/memory.current /sys/fs/cgroup/memory.stat inactive_file
                        cgroup_headroom /sys/fs/cgroup/memory/memory.limit_in_bytes /sys/fs/cgroup/memory/memory.usage_in_bytes /sys/fs/cgroup/memory/memory.stat total_inactive_file
                        echo "Memory usable by this build: ${EFFECTIVE_MB}MB (required: ${MIN_MB}MB)"
                        if [ "$EFFECTIVE_MB" -lt "$MIN_MB" ]; then
                            echo "ERROR: the Jenkins agent has too little free memory for the Mix production build."
                            echo "Give the agent more RAM/swap, or lower FRONTEND_BUILD_MIN_MEM_MB if you know the build fits."
                            exit 1
                        fi
                        # If something is going to be OOM-killed, make it this build and not the Jenkins JVM.
                        echo 1000 > /proc/self/oom_score_adj 2>/dev/null || true

                        echo "Step F2: Bootstrapping Node ${NODE_VERSION}..."
                        mkdir -p "${WORKSPACE}/.tools"
                        ARCH="$(uname -m)"
                        case "$ARCH" in
                            x86_64) NODE_ARCH="x64" ;;
                            aarch64|arm64) NODE_ARCH="arm64" ;;
                            *)
                                echo "Unsupported Jenkins agent architecture: $ARCH"
                                exit 1
                                ;;
                        esac
                        NODE_BASENAME="node-v${NODE_VERSION}-linux-${NODE_ARCH}"
                        NODE_HOME_DIR="${WORKSPACE}/.tools/${NODE_BASENAME}"
                        if [ ! -x "$NODE_HOME_DIR/bin/node" ]; then
                            NODE_BASE_URL="https://nodejs.org/dist/v${NODE_VERSION}"
                            curl -fsSL -o "${WORKSPACE}/.tools/${NODE_BASENAME}.tar.gz" "${NODE_BASE_URL}/${NODE_BASENAME}.tar.gz"
                            curl -fsSL -o "${WORKSPACE}/.tools/SHASUMS256.txt" "${NODE_BASE_URL}/SHASUMS256.txt"
                            (cd "${WORKSPACE}/.tools" && grep -F " ${NODE_BASENAME}.tar.gz" SHASUMS256.txt | sha256sum -c -)
                            tar -xzf "${WORKSPACE}/.tools/${NODE_BASENAME}.tar.gz" -C "${WORKSPACE}/.tools"
                            rm -f "${WORKSPACE}/.tools/${NODE_BASENAME}.tar.gz" "${WORKSPACE}/.tools/SHASUMS256.txt"
                        fi
                        export PATH="$NODE_HOME_DIR/bin:$PATH"
                        node --version
                        npm --version

                        echo "Step 0: Bootstrapping Infisical CLI on Jenkins workspace..."
                        if [ ! -x "$INFISICAL_BIN" ]; then
                            case "$ARCH" in
                                x86_64) INFISICAL_ARCH="amd64" ;;
                                aarch64|arm64) INFISICAL_ARCH="arm64" ;;
                            esac

                            curl -fsSL -o /tmp/infisical-cli.tar.gz \
                                "https://github.com/Infisical/cli/releases/download/v${INFISICAL_CLI_VERSION}/cli_${INFISICAL_CLI_VERSION}_linux_${INFISICAL_ARCH}.tar.gz"
                            tar -xzf /tmp/infisical-cli.tar.gz -C "${WORKSPACE}/.tools"
                            chmod +x "$INFISICAL_BIN"
                            rm -f /tmp/infisical-cli.tar.gz
                        fi
                        "$INFISICAL_BIN" --version

                        echo "Step 0b: Authenticating to Infisical via machine identity (env slug: ${INFISICAL_ENV_NAME})..."
                        export INFISICAL_DOMAIN
                        export INFISICAL_API_URL="$INFISICAL_DOMAIN"
                        echo "Using Infisical domain: $INFISICAL_DOMAIN (project: $INFISICAL_PROJECT_ID, env: $INFISICAL_ENV_NAME)"
                        export INFISICAL_TOKEN=$("$INFISICAL_BIN" login \
                            --method=universal-auth \
                            --client-id="$INFISICAL_CLIENT_ID" \
                            --client-secret="$INFISICAL_CLIENT_SECRET" \
                            --domain="$INFISICAL_DOMAIN" \
                            --silent --plain)
                        "$INFISICAL_BIN" export \
                            --projectId="$INFISICAL_PROJECT_ID" \
                            --env="$INFISICAL_ENV_NAME" \
                            --domain="$INFISICAL_DOMAIN" \
                            --format=dotenv \
                            --output-file="$ENV_FILE_LOCAL"

                        echo "Step 0c: Safeguard - validating exported secrets are non-empty..."
                        NONEMPTY_LINES=$(grep -vE '^[[:space:]]*(#|$)' "$ENV_FILE_LOCAL" 2>/dev/null | wc -l || echo 0)
                        if [ ! -s "$ENV_FILE_LOCAL" ] || [ "$NONEMPTY_LINES" -eq 0 ]; then
                            echo "ERROR: Infisical export for env='$INFISICAL_ENV_NAME' (project $INFISICAL_PROJECT_ID) returned an empty/invalid .env."
                            echo "Refusing to proceed - this would have overwritten the live secrets with nothing. Check the env slug exists in Infisical and the machine identity has access to it."
                            rm -f "$ENV_FILE_LOCAL"
                            exit 1
                        fi
                        echo "Exported $NONEMPTY_LINES secret line(s) for env='$INFISICAL_ENV_NAME'"

                        echo "Step F3: Building frontend assets (same as 'make build-artifact-frontend')..."
                        cd "$SRC"
                        git clean -ffdx -q
                        # Laravel Mix inlines MIX_* values from .env into the bundles at build time, so the build
                        # needs the same env the deploy host used to have. Removed again as soon as the build ends.
                        trap 'rm -f "$SRC/.env"' EXIT
                        cp "$ENV_FILE_LOCAL" .env
                        npm ci --no-audit --fund=false
                        npm run production
                        rm -f .env

                        echo "Step F4: Packaging build output..."
                        test -s public/mix-manifest.json
                        test -s public/js/inertia.js
                        # Everything the build produced under public/: ignored output (js, css, manifest) plus
                        # tracked files it rewrote (e.g. public/js/bootstrap.js) and untracked non-ignored files.
                        { git ls-files -z --others --ignored --exclude-standard -- public; git ls-files -z --modified --others --exclude-standard -- public; } | sort -zu > "${WORKSPACE}/.assets.list"
                        tar --null -czf "$ASSETS_TGZ" -T "${WORKSPACE}/.assets.list"
                        rm -f "${WORKSPACE}/.assets.list"
                        ls -lh "$ASSETS_TGZ"
                        echo "Frontend assets built from commit ${BUILD_COMMIT}"
                    '''
                }
            }
        }

        stage('Remote Atomic Build & Deploy') {
            when {
                beforeAgent true
                allOf {
                    not { changeRequest() }
                    anyOf { branch 'main'; branch 'develop' }
                }
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: env.SSH_CREDS, keyFileVariable: 'SSH_KEY_FILE')
                ]) {
                    sh '''
                        set -e
                        chmod 400 "$SSH_KEY_FILE"
                        BUILD_PATH="/home/$TARGET_USER/deployments/${ENV_NAME}_build_${BUILD_ID}"
                        ENV_FILE_LOCAL="${WORKSPACE}/.env.deploy"
                        ASSETS_TGZ="${WORKSPACE}/frontend-assets.tar.gz"
                        REMOTE_ENV_TMP="/tmp/hibarr-crm.env.${BUILD_ID}"
                        REMOTE_ASSETS_TMP="/tmp/hibarr-crm.assets.${BUILD_ID}.tar.gz"

                        test -s "$ENV_FILE_LOCAL"
                        test -s "$ASSETS_TGZ"

                        echo "Step 0d: Transferring .env and prebuilt frontend assets to target server..."
                        scp -i "$SSH_KEY_FILE" -P "$SSH_PORT" -o StrictHostKeyChecking=no \
                            "$ENV_FILE_LOCAL" "$TARGET_USER@$TARGET_HOST:$REMOTE_ENV_TMP"
                        rm -f "$ENV_FILE_LOCAL"
                        scp -i "$SSH_KEY_FILE" -P "$SSH_PORT" -o StrictHostKeyChecking=no \
                            "$ASSETS_TGZ" "$TARGET_USER@$TARGET_HOST:$REMOTE_ASSETS_TMP"
                        rm -f "$ASSETS_TGZ"

                        ssh -i $SSH_KEY_FILE -p $SSH_PORT -o StrictHostKeyChecking=no $TARGET_USER@$TARGET_HOST "
                            set -e

                            echo 'Step 0e: Backing up shared .env (rollback safety)...'
                            cp -f /home/$TARGET_USER/shared/.env /home/$TARGET_USER/shared/.env.bak 2>/dev/null || true

                            echo 'Step 0f: Safeguard - verifying transferred .env is non-empty before it can ever replace shared secrets...'
                            # (No backslashes or nested quotes on purpose: Groovy eats backslashes inside this sh block,
                            # which is what silently broke the old non-empty check.)
                            if ! grep -qE '^[[:space:]]*[^[:space:]#]' '$REMOTE_ENV_TMP'; then
                                echo 'ERROR: transferred .env is empty or invalid. Refusing to overwrite shared/.env. Aborting deploy before clone/build.'
                                rm -f '$REMOTE_ENV_TMP' '$REMOTE_ASSETS_TMP'
                                exit 1
                            fi

                            echo 'Step 1: Cloning and Building (backend; frontend assets were prebuilt on Jenkins)...'
                            mkdir -p $BUILD_PATH
                            cd $BUILD_PATH
                            git clone --depth 1 --branch $BRANCH_NAME https://github.com/HIBARR-Estates/hibarr-crm.git .
                            # Deploy exactly the commit Jenkins built the assets from, even if the branch moved meanwhile.
                            git fetch --depth 1 origin $BUILD_COMMIT
                            git checkout -q $BUILD_COMMIT

                            echo 'Step 1a: Installing prebuilt frontend assets...'
                            tar -xzf $REMOTE_ASSETS_TMP -C $BUILD_PATH
                            rm -f $REMOTE_ASSETS_TMP
                            test -s $BUILD_PATH/public/mix-manifest.json
                            test -s $BUILD_PATH/public/js/inertia.js

                            mv $REMOTE_ENV_TMP $BUILD_PATH/.env

                            # --- bootstrap/cache only for build; storage becomes shared symlink in Step 2 ---
                            mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
                            chmod -R 775 bootstrap/cache || true
                            # ----------------------------

                            # Backend build via Makefile: composer, proto, ziggy, build-version (no Node needed here).
                            # BUILD_ID is expanded by the Jenkins agent.
                            export BUILD_ID=$BUILD_ID
                            make build-artifact-backend

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

                            # Durable file cache/sessions/logs across atomic releases
                            bash $BUILD_PATH/scripts/link-shared-storage.sh \
                                /home/$TARGET_USER/shared/storage \
                                $BUILD_PATH \
                                $LIVE_LINK

                            echo 'Step 2b: Permission Guard (shared storage + bootstrap/cache)...'
                            bash $BUILD_PATH/scripts/fix-storage-permissions.sh $BUILD_PATH $TARGET_USER

                            echo 'Step 3: Database & Finalization...'
                            make finalize-deploy

                            echo 'Step 4: Atomic Switch...'
                            ln -sfn $BUILD_PATH $LIVE_LINK

                            echo 'Step 5: Re-apply Permission Guard after switch...'
                            bash $BUILD_PATH/scripts/fix-storage-permissions.sh $BUILD_PATH $TARGET_USER

                            echo 'Step 6: Production Optimization...'
                            cd $LIVE_LINK
                            php artisan config:cache
                            php artisan route:cache
                            php artisan view:cache

                            # Reload PHP-FPM to clear OPcache (staging=8.2, production=8.3)
                            if [ "$ENV_NAME" = "production" ]; then
                                sudo systemctl reload php8.3-fpm || true
                            else
                                sudo systemctl reload php8.2-fpm || true
                            fi

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

                            echo 'Step 8: Ensure reminder queues + Laravel scheduler, then restart workers...'
                            # Re-apply supervisor queue list (incl. reminders-prepare/send) and
                            # ensure cron runs schedule:run for reminders:prepare / reminders:send-due.
                            # queue:restart alone is not enough — workers must listen to those queues.
                            if [ "$ENV_NAME" = "production" ]; then
                                LIVE_LINK="$LIVE_LINK" bash "$LIVE_LINK/scripts/fix_for_supervisor_atom_deploy_prod.sh" || true
                                bash "$LIVE_LINK/scripts/ensure_laravel_scheduler_cron.sh" "$LIVE_LINK/artisan" || true
                                sudo supervisorctl restart hibarr_crm_expose:* || true
                            else
                                LIVE_LINK="$LIVE_LINK" bash "$LIVE_LINK/scripts/fix_for_supervisoc_atom_deploy_staging.sh" || true
                                bash "$LIVE_LINK/scripts/ensure_laravel_scheduler_cron.sh" "$LIVE_LINK/artisan" || true
                                sudo supervisorctl restart hibarr_crm_staging_expose:* || true
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

    post {
        always {
            // Secrets and bulky artifacts must not linger in the Jenkins workspace, whichever stage failed.
            sh 'rm -f "$WORKSPACE/.env.deploy" "$WORKSPACE/frontend-assets.tar.gz" "$WORKSPACE/.assets.list" "$WORKSPACE/frontend-src/.env"'
        }
    }
}