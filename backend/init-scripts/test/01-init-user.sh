#!/bin/bash

set -e

# Create the user if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL

    DO
    \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$POSTGRES_USER') THEN
            CREATE ROLE $POSTGRES_USER WITH LOGIN SUPERUSER PASSWORD '$POSTGRES_PASSWORD';
        END IF;
    END
    \$\$;
    ALTER USER $POSTGRES_USER WITH SUPERUSER;
    GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;

EOSQL
