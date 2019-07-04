name="DtDJS"
if ! screen -list | grep -q $name; then
    screen -dmS $name
fi
screen -S $name -X stuff 'node app.js
'