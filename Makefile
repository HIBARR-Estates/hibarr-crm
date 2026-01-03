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
# Branch management helpers
# ------------------------------------

checkout-branch:
	@echo "Switching to branch: $(BRANCH)"
	git fetch origin
	git checkout -f $(BRANCH) || git checkout -b $(BRANCH) origin/$(BRANCH)
	git clean -fd -e storage

reset-and-pull:
	@echo "Resetting and pulling latest changes from $(BRANCH)"
	git fetch origin
	git reset --hard origin/$(BRANCH)
	git clean -fd -e storage

reset-repo:
	git restore --staged .
	git restore .
	git clean -fd -e storage



# ------------------------------------
# Generic tasks
# ------------------------------------

sync-to-webroot:
	rsync -av $(RSYNC_EXCLUDES) ./ $(WEBROOT)

composer-install:
	composer install --no-interaction --prefer-dist --optimize-autoloader

npm-build:
	npm install
	php artisan ziggy:generate
	npm run production

migrate:
	php artisan migrate --force

ensure-storage:
	mkdir -p storage/framework/cache/data
	mkdir -p storage/framework/sessions
	mkdir -p storage/framework/views
	mkdir -p storage/logs
	chmod -R 775 storage || true

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
	cd $(WEBROOT) && \
	git fetch origin && \
	git checkout -f main && \
	git reset --hard origin/main && \
	git clean -fd -e storage && \
	$(MAKE) composer-install && \
	$(MAKE) npm-build && \
	$(MAKE) migrate && \
	php artisan optimize:clear && \
	$(MAKE) queue-restart