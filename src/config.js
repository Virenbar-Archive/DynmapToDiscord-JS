//Example
var config = {}
//Domain or ip
config.host = 'minecrafting.ru'
//Default 25565
//config.port = 25565
//URL to json standalone or internal server
config.dynmap = 'http://map.minecrafting.ru/standalone/dynmap_world.json'
//old'' config.dynmap = 'https://pastebin.com/raw/8zEeWM5m'
//config.dynmap = 'https://pastebin.com/raw/6fEXUHis'
//Discord webhook
config.webhook = process.env.webhook//'https://discordapp.com/api/webhooks/<>/<>'

module.exports = config