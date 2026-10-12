#!/bin/sh
# Sets the Gmail mailbox the CRM sends its emails from (invites, "set your password").
# It ASKS for the two things — nothing has to be typed into the command itself:
#
#   ssh -t root@<server> "cd /var/www/webrocz && sh scripts/set-mailbox.sh"
#
# The address and the app password are written to the server's .env (never to git), any old
# GMAIL_ lines are replaced, and the CRM is restarted so it starts using them.
set -e
cd "$(dirname "$0")/.."

printf 'Gmail address that will send the emails: '
read -r MAILUSER
MAILUSER=$(printf '%s' "$MAILUSER" | tr -d ' \t\r')
case "$MAILUSER" in
  *@*.*) ;;
  *) echo "That is not an email address. Nothing was changed."; exit 1 ;;
esac

printf 'App password of that Gmail (16 letters - it is NOT shown while you type or paste): '
stty -echo 2>/dev/null || true
read -r MAILPASS
stty echo 2>/dev/null || true
echo
MAILPASS=$(printf '%s' "$MAILPASS" | tr -d ' \t\r')
if [ "${#MAILPASS}" -lt 8 ]; then
  echo "No app password was entered. Nothing was changed."
  exit 1
fi

touch .env
grep -v -e '^GMAIL_USER=' -e '^GMAIL_APP_PASSWORD=' .env > .env.mailbox-tmp || true
printf 'GMAIL_USER=%s\nGMAIL_APP_PASSWORD=%s\n' "$MAILUSER" "$MAILPASS" >> .env.mailbox-tmp
cat .env.mailbox-tmp > .env
rm -f .env.mailbox-tmp

pm2 restart webrocz-crm --update-env
echo "Mailbox set to $MAILUSER"
echo MAILBOX_SET
