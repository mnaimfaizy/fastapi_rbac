#!/bin/bash

# Create directories if they don't exist
mkdir -p certs

# Generate CA key and certificate
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -sha256 -key ca.key -days 3650 -out ca.crt -subj "/CN=Redis CA"

# Generate Redis server key and CSR with SANs using redis_cert.cnf
openssl genrsa -out redis.key 2048
openssl req -new -key redis.key -out redis.csr -config redis_cert.cnf

# Sign the Redis server certificate with our CA and SAN
openssl x509 -req -sha256 -days 365 -in redis.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out redis.crt -extensions v3_req -extfile redis_cert.cnf

# Clean up CSR and serial files
rm redis.csr ca.srl

# Set proper permissions
chmod 644 *.crt
chmod 600 *.key

echo "Certificates generated successfully!"
