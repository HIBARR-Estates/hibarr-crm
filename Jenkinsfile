pipeline {
    agent any

    stages {
        stage('Build Artifact (on Jenkins)') {
            steps {
                echo 'Building Application...'
                // Run the heavy tasks on Jenkins instead of the server
                sh '''
                    # make build-artifact // pending when make is installed in jenkins server
                    

                    composer install --no-interaction --prefer-dist --optimize-autoloader
                    
                    # Package everything including the built assets and vendor
                    # We exclude .git to keep the file small
                    tar -czf hibarr-crm-build.tar.gz . --exclude=.git
                '''
            }
        }

        stage('Deploy to Staging') {
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
                        
                        # 1. Upload the pre-built artifact
                        scp -i $SSH_KEY_FILE -P 2244 -o StrictHostKeyChecking=no hibarr-crm-build.tar.gz $STAGING_USER@$STAGING_HOST:/tmp/

                        # 2. Extract and swap using the "Atomic" method
                        ssh -i $SSH_KEY_FILE -p 2244 -o StrictHostKeyChecking=no $STAGING_USER@$STAGING_HOST "
                            mkdir -p ~/deployments/build_${BUILD_ID}
                            tar -xzf /tmp/hibarr-crm-build.tar.gz -C ~/deployments/build_${BUILD_ID}
                            
                            # Link the existing .env and uploads that aren't in the build
                            ln -sfn ~/shared/.env ~/deployments/build_${BUILD_ID}/.env
                            mkdir -p ~/deployments/build_${BUILD_ID}/public/user-uploads
                            # Link persistent uploads so they aren't lost
                            ln -sfn ~/shared/user-uploads ~/deployments/build_${BUILD_ID}/public/user-uploads

                            # Run migration and storage setup on the new folder
                            cd ~/deployments/build_${BUILD_ID}
                            make finalize-deploy

                            # THE SWITCH
                            ln -sfn ~/deployments/build_${BUILD_ID} ~/hibarr-crm-staging
                            
                            # Cleanup old builds
                            rm /tmp/hibarr-crm-build.tar.gz
                            cd ~/deployments && ls -t | tail -n +6 | xargs rm -rf 2>/dev/null || true
                        "
                    '''
                }
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'hibarr-crm-build.tar.gz', onlyIfSuccessful: true
            script { try { cleanWs() } catch (e) { } }
        }
    }
}