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
	git clean -fd -e storage -e node_modules -e vendor

reset-and-pull:
	@echo "Resetting and pulling latest changes from $(BRANCH)"
	git fetch origin
	git reset --hard origin/$(BRANCH)
	git clean -fd -e storage -e node_modules -e vendor

reset-repo:
	git restore --staged .
	git restore .
	git clean -fd -e storage -e node_modules -e vendor



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

# ------------------------------------
# gRPC / Protocol Buffers
# ------------------------------------

PROTO_DIR := proto
PROTO_OUT := app/Grpc/Generated
PROTOC := protoc

# Generate PHP classes from .proto files
proto:
	@echo "Generating PHP classes from Protocol Buffer definitions..."
	@mkdir -p $(PROTO_OUT)
	$(PROTOC) \
		--proto_path=$(PROTO_DIR) \
		--php_out=$(PROTO_OUT) \
		$(PROTO_DIR)/common.proto $(PROTO_DIR)/deal.proto $(PROTO_DIR)/lead.proto $(PROTO_DIR)/property.proto $(PROTO_DIR)/task.proto
	@if [ -d "$(PROTO_OUT)/App/Grpc/Generated" ]; then \
		cp -r $(PROTO_OUT)/App/Grpc/Generated/* $(PROTO_OUT)/ && \
		rm -rf $(PROTO_OUT)/App; \
	fi
	@echo "Proto generation complete. Output in $(PROTO_OUT)"

# Clean generated proto files and regenerate
proto-clean:
	@echo "Cleaning generated files..."
	rm -rf $(PROTO_OUT)/Common $(PROTO_OUT)/Deal $(PROTO_OUT)/Lead $(PROTO_OUT)/Property $(PROTO_OUT)/Task $(PROTO_OUT)/GPBMetadata
	$(MAKE) proto

# Install RoadRunner binary
rr-install:
	@echo "Installing RoadRunner binary..."
	php vendor/bin/rr get-binary

# Start RoadRunner server (development) - Windows
rr-serve:
	rr.exe serve -c .rr.yaml

# Start RoadRunner server (production) - Windows
rr-serve-prod:
	rr.exe serve -c .rr.yaml -o "logs.mode=production" -o "reload.enabled=false"

# Stop RoadRunner server - Windows
rr-stop:
	rr.exe stop -c .rr.yaml

# Check RoadRunner workers - Windows
rr-workers:
	rr.exe workers -c .rr.yaml

# ------------------------------------
# RoadRunner Linux Commands (Production)
# ------------------------------------

# Start RoadRunner server (staging) - Linux
# Uses .rr.staging.yaml which binds to 127.0.0.1 (nginx fronts with TLS)
rr-serve-staging:
	./rr serve -c .rr.staging.yaml

# Start RoadRunner server (development) - Linux
rr-serve-linux:
	./rr serve -c .rr.yaml

# Start RoadRunner server (production) - Linux
rr-serve-prod-linux:
	./rr serve -c .rr.yaml -o "logs.mode=production" -o "reload.enabled=false"

# Stop RoadRunner server - Linux
rr-stop-linux:
	./rr stop -c .rr.yaml || true

# Check RoadRunner workers - Linux
rr-workers-linux:
	./rr workers -c .rr.yaml

# Restart RoadRunner systemd service
rr-restart-service:
	sudo systemctl restart roadrunner-grpc || true

# Check RoadRunner systemd service status
rr-status-service:
	sudo systemctl status roadrunner-grpc

# ------------------------------------
# Storage and permissions
# ------------------------------------

ensure-storage:
	@echo "Ensuring storage structure exists..."
	mkdir -p storage/framework/cache/data
	mkdir -p storage/framework/sessions
	mkdir -p storage/framework/views
	mkdir -p storage/logs
	# We use || true because in some builds the folder might be owned by www-data
	chmod -R 775 storage bootstrap/cache || true

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
	git clean -fd -e storage -e node_modules -e vendor && \
	$(MAKE) ensure-storage && \
	$(MAKE) composer-install && \
	$(MAKE) npm-build && \
	$(MAKE) migrate && \
	php artisan optimize:clear && \
	$(MAKE) queue-restart


# Run this on Jenkins to prepare the artifact
build-artifact:
	@if [ ! -f composer.phar ]; then curl -sS https://getcomposer.org/installer | php; fi
	php composer.phar install --no-interaction --prefer-dist --optimize-autoloader
	npm install
	php artisan ziggy:generate
	npm run production

# This target is for the server to run after extracting the artifact
finalize-deploy:
	$(MAKE) ensure-storage
	php artisan migrate --force
	php artisan queue:restart
	# Clear old junk but do NOT cache yet (Jenkins does that after the symlink switch)
	php artisan cache:clear
	php artisan config:clear
	php artisan route:clear

# ------------------------------------
# gRPC Server Setup (one-time on staging/prod)
# ------------------------------------

# Install the systemd service unit for RoadRunner gRPC
setup-grpc-service:
	@echo "Installing RoadRunner gRPC systemd service..."
	sudo cp scripts/roadrunner-grpc.service /etc/systemd/system/roadrunner-grpc.service
	sudo systemctl daemon-reload
	sudo systemctl enable roadrunner-grpc
	@echo "Service installed. Start with: sudo systemctl start roadrunner-grpc"

# Install the nginx gRPC reverse proxy config
# Usage: make setup-grpc-nginx DOMAIN=grpc.staging.example.com
setup-grpc-nginx:
	@if [ -z "$(DOMAIN)" ]; then echo "ERROR: DOMAIN required. Usage: make setup-grpc-nginx DOMAIN=grpc.staging.example.com"; exit 1; fi
	@echo "Installing nginx gRPC proxy config for $(DOMAIN)..."
	sed 's/grpc\.staging\.YOURDOMAIN\.com/$(DOMAIN)/g' scripts/nginx-grpc-staging.conf \
		| sudo tee /etc/nginx/sites-available/grpc-staging > /dev/null
	sudo ln -sf /etc/nginx/sites-available/grpc-staging /etc/nginx/sites-enabled/
	sudo nginx -t
	sudo systemctl reload nginx
	@echo "Nginx configured. Run: sudo certbot --nginx -d $(DOMAIN)"

# Health check — verifies gRPC server is responding
grpc-health:
	@curl -sf http://127.0.0.1:2114/health > /dev/null 2>&1 \
		&& echo "gRPC health: OK" \
		|| (echo "gRPC health: FAILED" && exit 1)