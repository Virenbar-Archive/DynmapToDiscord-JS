////Example
var config = {}
////Domain or ip
config.host = 'example.net'
////Port default 25565
//config.port = 25565
////URL to json standalone or internal server
config.dynmap = 'http://<host>/standalone/dynmap_world.json'
//config.dynmap = 'http://<host>/up/world/<world_name>/'
////Discord webhook
config.webhook = 'https://discordapp.com/api/webhooks/<>/<>'

module.exports = config