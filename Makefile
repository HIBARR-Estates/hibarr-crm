# Makefile for deploying WorkSuite CRM
# ------------------------------------

# Paths
PROJECT_DIR := $(HOME)/hibarr-crm
PROJECT_DIR_STAGING := $(HOME)/hibarr-crm-staging
WEBROOT := /var/www/html

# Common excludes for rsync
RSYNC_EXCLUDES := \
    --exclude 'public/user-uploads' \
    --exclude 'public/favicon.ico' \
    --exclude 'storage/app/modules_statuses.json' \
    --exclude 'Modules' \
    --exclude '.env' \
    --exclude 'public/js' \
    --exclude 'public/css' \
    --exclude 'public/build' \
    --exclude 'public/mix-manifest.json'

# ------------------------------------
# Generic tasks
# ------------------------------------

reset-repo:
	git restore --staged .
	git restore .
	git clean -fd

sync-to-webroot:
	rsync -av $(RSYNC_EXCLUDES) ./ $(WEBROOT)

composer-install:
	composer install --no-interaction --prefer-dist --optimize-autoloader

npm-build:
	npm install
	npm run production

migrate:
	php artisan migrate --force

queue-restart:
	php artisan queue:restart

# ------------------------------------
# Deployment targets
# ------------------------------------

deploy-staging:
	cd $(PROJECT_DIR_STAGING) && \
	$(MAKE) reset-repo && \
	git pull origin staging && \
	$(MAKE) sync-to-webroot && \
	cd $(WEBROOT) && \
	$(MAKE) composer-install && \
	$(MAKE) npm-build && \
	$(MAKE) migrate && \
	$(MAKE) queue-restart

deploy-production:
	cd $(PROJECT_DIR) && \
	$(MAKE) reset-repo && \
	git pull origin main && \
	$(MAKE) sync-to-webroot && \
	cd $(WEBROOT) && \
	$(MAKE) composer-install && \
	$(MAKE) npm-build && \
	$(MAKE) migrate && \
	$(MAKE) queue-restart
