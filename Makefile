# ───────────────────────────────────────────
#  Docker Lifecycle
# ───────────────────────────────────────────
up:
	docker compose up -d --build

down:
	docker compose down

restart:
	docker compose down && docker compose up -d --build

bash:
	docker exec -it hibarr-crm-app bash

logs:
	docker logs -f hibarr-crm-app

nginx-logs:
	docker logs -f hibarr-crm-nginx

traefik-logs:
	docker logs -f hibarr-crm-traefik


# ───────────────────────────────────────────
#  Backend Commands (Laravel)
# ───────────────────────────────────────────
composer:
	docker exec -it hibarr-crm-app composer install --no-interaction --prefer-dist --optimize-autoloader

migrate:
	docker exec -it hibarr-crm-app php artisan migrate

migrate-prod:
	docker exec -it hibarr-crm-app php artisan migrate --force

seed:
	docker exec -it hibarr-crm-app php artisan db:seed

key:
	docker exec -it hibarr-crm-app php artisan key:generate

queue-restart:
	docker exec -it hibarr-crm-app php artisan queue:restart


# ───────────────────────────────────────────
#  Frontend Commands (NPM Build in Container)
# ───────────────────────────────────────────
npm-install:
	docker exec -it hibarr-crm-app npm install

npm-dev:
	docker exec -it hibarr-crm-app npm run dev

npm-build:
	docker exec -it hibarr-crm-app npm run production
