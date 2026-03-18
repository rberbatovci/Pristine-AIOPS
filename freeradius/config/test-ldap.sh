#!/bin/bash

# ------------------------
# Configuration
# ------------------------
AD_SERVER="ldaps://WinServer01.pristine-aiops.local"
BIND_USER="svc_freeradius@pristine-aiops.local"
BIND_PASS="Testing123!"
BASE_DN="DC=pristine-aiops,DC=local"
TEST_USER="engineer-t2"  # Replace with an existing AD user
CA_FILE="/etc/ssl/certs/win-server01.pristine-aiops.local.pem"

echo "---------------------------------------"
echo "Testing LDAP connection to Active Directory..."
# Test bind and search for a user
if ldapsearch -H "$AD_SERVER" \
            -D "$BIND_USER" \
            -w "$BIND_PASS" \
            -b "$BASE_DN" \
            "(sAMAccountName=$TEST_USER)" \
            -LLL \
            -d 1 \
            -o ldif-wrap=no \
            -o nettimeout=5 \
            -o timelimit=5 \
            -o tls_reqcert=allow \
            -CAfile "$CA_FILE"; then
    echo "LDAP test passed. Starting FreeRADIUS..."
    exec freeradius -X
else
    echo "LDAP test failed. FreeRADIUS will not start!"
    echo "Sleeping so you can debug..."
    tail -f /dev/null   # <- keeps the container running
fi
