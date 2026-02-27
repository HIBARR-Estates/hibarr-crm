# make sure to automate this in the future, e.g. during during deployment


## Run a su - 
## 5c5sAbt8eME

# 1. Remove the symlink
sudo rm /var/www/.cache/puppeteer

# 2. Recreate as a real directory
sudo mkdir -p /var/www/.cache/puppeteer

# 3. Copy Chrome files
sudo cp -r /home/hibarr/.cache/puppeteer/* /var/www/.cache/puppeteer/

# 4. Set ownership
sudo chown -R www-data:www-data /var/www/.cache/puppeteer

# 5. Verify ownership and file exists
ls -la /var/www/.cache/puppeteer/chrome-headless-shell/linux-143.0.7499.146/chrome-headless-shell-linux64/chrome-headless-shell

# 6. Restart PHP-FPM
sudo systemctl restart php8.3-fpm