pipeline {
    agent none // We define specific agents for each stage

    stages {
        stage('Build Artifact') {
            // Jenkins will spin up this container specifically for this stage
            agent {
                docker { 
                    image 'php:8.3-cli' 
                    // We map the composer and npm cache to speed up future builds
                    args '-u root' 
                }
            }
            steps {
                echo 'Building Application in PHP 8.3 Container...'
                sh '''
                    # 1. Install system dependencies needed for Laravel/Composer
                    apt-get update && apt-get install -y libzip-dev unzip git
                    docker-php-ext-install zip

                    # 2. Install Composer inside the container
                    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

                    # 3. Install Node.js (since PHP images don't usually have it)
                    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                    apt-get install -y nodejs

                    # 4. Run your build
                    composer install --no-interaction --prefer-dist --optimize-autoloader
                    npm install
                    touch .env
                    php artisan ziggy:generate
                    npm run production
                    
                    # 5. Create the artifact
                    tar -czf hibarr-crm-build.tar.gz . --exclude=.git
                '''
            }
        }

        stage('Deploy to Staging') {
            agent any // Deployment uses the main Jenkins agent to handle SSH
            when { 
                anyOf { branch 'staging'; branch 'develop' }
            }
            environment {
                STAGING_HOST = credentials('STAGING_HOST')
                STAGING_USER = credentials('STAGING_USER')
            }
            steps {
                withCredentials([sshUserPrivateKey(credentialsId: 'STAGIN_SSH_PRIVATE_KEY', keyFileVariable: 'SSH_KEY_FILE')]) {
                    sh '''
                        chmod 400 $SSH_KEY_FILE
                        scp -i $SSH_KEY_FILE -P 2244 -o StrictHostKeyChecking=no hibarr-crm-build.tar.gz $STAGING_USER@$STAGING_HOST:/tmp/

                        ssh -i $SSH_KEY_FILE -p 2244 -o StrictHostKeyChecking=no $STAGING_USER@$STAGING_HOST "
                            mkdir -p ~/deployments/build_${BUILD_ID}
                            tar -xzf /tmp/hibarr-crm-build.tar.gz -C ~/deployments/build_${BUILD_ID}
                            ln -sfn ~/shared/.env ~/deployments/build_${BUILD_ID}/.env
                            mkdir -p ~/deployments/build_${BUILD_ID}/public/user-uploads
                            ln -sfn ~/shared/user-uploads ~/deployments/build_${BUILD_ID}/public/user-uploads

                            cd ~/deployments/build_${BUILD_ID}
                            make finalize-deploy

                            ln -sfn ~/deployments/build_${BUILD_ID} ~/hibarr-crm-staging
                            rm /tmp/hibarr-crm-build.tar.gz
                            cd ~/deployments && ls -t | tail -n +6 | xargs rm -rf 2>/dev/null || true
                        "
                    '''
                }
            }
        }
    }
}