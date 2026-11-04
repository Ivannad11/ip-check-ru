#!/bin/sh
# Выкладка на naezasoft.ru/ip-check/ (metaphora-vds).
# Сайт статический; новости пересобирает cron на сервере раз в час.
set -e
cd "$(dirname "$0")"
DST=/var/www/naezasoft/ip-check
ssh metaphora-vds "mkdir -p $DST /opt/ip-check"
rsync -az --delete --exclude '.git' --exclude '.github' --exclude 'scripts' --exclude 'deploy.sh' \
  --exclude 'news/news.json' --exclude '.DS_Store' --exclude 'robots.txt' --exclude '.nojekyll' ./ metaphora-vds:$DST/
# Первую ленту кладём готовую, дальше её ведёт сервер
ssh metaphora-vds "[ -f $DST/news/news.json ]" || rsync -az news/news.json metaphora-vds:$DST/news/
rsync -az scripts/build_news.py metaphora-vds:/opt/ip-check/
ssh metaphora-vds "chown -R www-data:www-data $DST 2>/dev/null || true
  echo '23 * * * * root NEWS_OUT=$DST/news/news.json python3 /opt/ip-check/build_news.py >> /var/log/ip-check-news.log 2>&1' > /etc/cron.d/ip-check-news"
echo "→ https://naezasoft.ru/ip-check/"
