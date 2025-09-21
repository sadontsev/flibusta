#!/bin/sh
mkdir -p /app/sql/psql
mkdir -p /app/cache/authors
mkdir -p /app/cache/covers

echo "Распаковка sql.gz" > /app/sql/status
gzip -f -d /app/sql/*.gz

/app/tools/app_topg_fixed lib.a.annotations_pics.sql
/app/tools/app_topg_fixed lib.b.annotations_pics.sql
/app/tools/app_topg_fixed lib.a.annotations.sql
/app/tools/app_topg_fixed lib.b.annotations.sql
/app/tools/app_topg_fixed lib.libavtorname.sql
/app/tools/app_topg_fixed lib.libavtor.sql
/app/tools/app_topg_fixed lib.libbook.sql
/app/tools/app_topg_fixed lib.libfilename.sql
/app/tools/app_topg_fixed lib.libgenrelist.sql
/app/tools/app_topg_fixed lib.libgenre.sql
/app/tools/app_topg_fixed lib.libjoinedbooks.sql
/app/tools/app_topg_fixed lib.librate.sql
/app/tools/app_topg_fixed lib.librecs.sql
/app/tools/app_topg_fixed lib.libseqname.sql
/app/tools/app_topg_fixed lib.libseq.sql
/app/tools/app_topg_fixed lib.libtranslator.sql
/app/tools/app_topg_fixed lib.reviews.sql

echo "Обновление полнотекстовых индексов" >> /app/sql/status
PGPASSWORD=flibusta psql -h postgres -d flibusta -U flibusta -f /app/tools/update_vectors.sql

echo "Создание индекса zip-файлов" >> /app/sql/status
# php /app/tools/app_update_zip_list.php

echo "" > /app/sql/status
