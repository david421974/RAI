docker exec -it stats_db psql -U stats -d stats -c "DELETE FROM intent_hits WHERE hits="$1
