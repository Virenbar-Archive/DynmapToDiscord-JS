/* eslint-disable no-console */
const http = require('request-promise-native')
const mc = require('minecraft-protocol')

require('./lib/timestamp')()
const config = require('./config')
const serverhost = config.host
const serverport = config.port || 25565
const dynmapfile = config.dynmap

const name = 'Dynmap to Discord'
const version = '3.1'
const serverWait = 60 * 1000
const dynmapWait = 10 * 1000
const listWait = 5 * 1000
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

var serverInfo
var dynmapInfo
var timestamp = 0 //420000
var playersPrev = []
var playersHash = ''

async function sendRequest(payload) {
  try {
    //console.log(payload.embeds[0])
    let path = config.webhook
    let response = await http({
      'uri': path,
      'method': 'POST',
      'headers': {
        "Content-Type": 'application/json',
        "Content-Length": payload.length
      },
      'body': payload,
      'resolveWithFullResponse': true,
      'json': true
    })
    //console.log(JSON.stringify(response,null,10))
    if (response.statusCode != 204) {
      console.log('Response:\n' + response.body + ', code = ' + response.statusCode)
    }
    /* console.log('Left '+response.headers['x-ratelimit-remaining']+
      '/'+response.headers['x-ratelimit-limit']+
      '. Reset in '+new Date(response.headers['x-ratelimit-reset']*1000)+
      ' '+(response.headers['x-ratelimit-reset']-Math.floor(Date.now()/1000))
    ) */
  } catch (err) {
    console.log('Error sending post request')
    console.info(err)
  }
}

function getServerInfo() {
  return new Promise((resolve, reject) => {
    mc.ping({
      host: serverhost,
      port: serverport
    }, (err, result) => {
      if (err) {
        reject(err)
      }
      resolve(result)
    })
  })
}

async function getDynmapInfo() {
  try {
    let data = await http.get(dynmapfile)
    let json = JSON.parse(data)
    return json
  } catch (err) {
    console.log(err)
    return {}
  }
}

async function getPlayerList() {
  try {
    let players = []
    serverInfo.players.sample.forEach(player => {
      players.push(player.name)
    })
    while (players.length < serverInfo.players.online) {
      serverInfo = await getServerInfo()
      serverInfo.players.sample.forEach(player => {
        if (!players.includes(player.name)) {
          players.push(player.name)
          //console.log(player.name)
        }
      })
      await sleep(listWait)
    }
    players.sort()
    return players
  } catch (err) {
    console.log('Error getting player list')
    console.info(err)
  }
}

async function getUUID(name) {
  try {
    let data = await http.get('https://api.mojang.com/users/profiles/minecraft/' + name)
    let json = JSON.parse(data)
    return json.id
  } catch (err) {
    console.log('Player not found: ' + name)
    console.info(err)
    return '00000000-0000-0000-0000-000000000000'
  }
}

function sendMessage(msgs) {
  if (!Array.isArray(msgs)) {
    msgs = [msgs]
  }
  //console.log(msgs.length)
  let embeds = new Array()
  for (const msg of msgs) {
    embeds.push({
      "author": {
        "name": msg.name,
        "url": '',
        "icon_url": msg.icon
      },
      "title": msg.title,
      "description": msg.message || 'WAT',
      "color": msg.color,
      "footer": {
        "icon_url": msg.footer_icon,
        "text": msg.footer
      },
      "timestamp": msg.timestamp || ''
    })
  }
  const message = {
    //content : ""
    //username : ""
    //avatar_url : ""
    "embeds": embeds
  }
  //let payload = JSON.stringify(message)
  return sendRequest(message)
}

function nodash(str) {
  //Underscore escape
  return str.replace(/^_/, '\\_').replace(/_$/, '\\_')
}

async function CheckServer() {
  try {
    serverInfo = await getServerInfo()
    if (!serverInfo) {
      return false
    }
    let players = []
    if (serverInfo.players.sample) {
      players = await getPlayerList()
    }
    let playersHashNew = players.join('')
    if (playersHash == playersHashNew) {
      //Возврат если ничего не поменялось
      return true
    }
    playersHash = playersHashNew

    let playersOnline = []
    let playersList = []
    players.forEach(player => {
      if (playersPrev.includes(player)) {
        playersOnline.push(player)
        playersPrev.splice(playersPrev.indexOf(player), 1)
        playersList.push(nodash(player))
      } else {
        playersOnline.push(player)
        playersList.unshift('__' + nodash(player) + '__')
      }
    })
    playersPrev.forEach(player => {
      playersList.push('~~' + nodash(player) + '~~')
    })
    playersPrev = playersOnline

    sendMessage({
      //title = 'Список игроков',
      'message': playersList.join(' '),
      //'color': 0xffffff,
      'footer': 'Список игроков (' + playersOnline.length + ')',
      'timestamp': new Date().toISOString()
    }) //*/
    return true
  } catch (err) {
    console.log('Ошибка обработки сервера')
    console.info(serverInfo)
    console.info(err)
  }
}

async function CheckDynmap() {
  try {
    dynmapInfo = await getDynmapInfo()
    if (!dynmapInfo) {
      return false
    }
    let myEmbeds = new Array()
    for (const event of dynmapInfo.updates) {
      if (event.timestamp > timestamp && event.type != 'tile') {
        if (event.type == 'chat') {
          //console.log(event.timestamp)
          let time = new Date(event.timestamp).toISOString()
          if (event.source == 'player') {
            let player = event.account.replace(/[&]./g, '')
            let uuid = await getUUID(player.replace(/\[.*?\]/g, ''))
            myEmbeds.push({
              //"name" = player,
              //"icon" = 'https://crafatar.com/avatars/'..getUUID(player:gsub('%[.-%]',''))..'?overlay',   --Steve 00000000-0000-0000-0000-000000000000 Alex ..0001
              "message": event.message,
              "color": parseInt((event.playerName.match(/"color:#(.+)"/) || ['', 'ffffff'])[1], 16),
              "footer_icon": 'https://crafatar.com/avatars/' + uuid + '?overlay',
              "footer": player,
              "timestamp": time
            })
          } else if (event.source == 'plugin') {
            if (event.message.startsWith('[Server]')) {
              myEmbeds.push({
                //"name" : 'Server',
                //"icon" : serverInfo.favicon,
                "message": event.message.substr(8),
                "color": 0xFF55FF,
                //"footer_icon": '',
                "footer": 'Server',
                "timestamp": time
              })
            } else if (!event.message.match(/вошел|вышел/i)) {
              myEmbeds.push({
                //"name" : 'Server',
                //"icon" : serverInfo.favicon,
                "message": event.message,
                "color": 0xFFFF55,
                //"footer_icon": '',
                "footer": 'Unknown',
                "timestamp": time
              })
            }
          } else if (event.source == 'web') {
            myEmbeds.push({
              //"name" : '[Web]'..event.playerName,
              "message": event.message,
              "color": 0xffffff,
              "footer": '[Web]' + event.playerName,
              "timestamp": time
            })
          }
        }
      }
      if (myEmbeds.length == 10) {
        await sendMessage(myEmbeds)
        myEmbeds.length = 0
      }
    }
    if (myEmbeds.length > 0) {
      await sendMessage(myEmbeds)
    }
    timestamp = dynmapInfo.timestamp
    return true
  } catch (err) {
    console.log('Ошибка обработки событий\n' + dynmapInfo + '\n' + err)
    return false
  }
}

async function Init() {
  try {
    serverInfo = await getServerInfo()
    let players = []
    if (serverInfo.players.sample) {
      players = await getPlayerList()
    }
    //playersHash = table.concat(players)
    players.forEach(player => {
      playersPrev.push(player)
    })
    sendMessage({
      "title": name,
      "message": 'Version: ' + version,
      "timestamp": new Date().toISOString()
    }) //*/
    console.info('Ready ' + new Date().toISOString())
    console.info('Connected to ' + serverInfo.description.text + '\non ' + serverhost + ":" + serverport)
  } catch (err) {
    throw "Can`t connect to " + serverhost + ":" + serverport + "\n" + err
  }
}

async function LoopServer() {
  try {
    let stServer = await CheckServer()
    if (stServer) {
      let ps = 4 * (serverInfo.players.online / serverInfo.players.max)
      setTimeout(LoopServer, serverWait+ps)
    } else {
      setTimeout(LoopServer, serverWait * 2)
      console.log('No connection to server. Slow mod.')
    }
  } catch (err) {
    console.log('Ошибка в цикле\n' + err)
  }
}

async function LoopDynmap() {
  try {
    let stDynmap = await CheckDynmap()
    if (stDynmap) {
      setTimeout(LoopDynmap, dynmapWait)
    } else {
      setTimeout(LoopDynmap, dynmapWait * 2)
      console.log('No connection to dynmap. Slow mod.')
    }
  } catch (err) {
    console.log('Ошибка в цикле\n' + err)
  }
}
//Main
(async () => {
  try {
    await Init()
    LoopServer()
    LoopDynmap()
    //CheckServer()
    //CheckDynmap()
  } catch (err) {
    throw err
  }
})()
/**Notes
 * Loops separated because getPlayerList is too slow when players>20
 */