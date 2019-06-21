/* eslint-disable no-console */
const http = require('request-promise-native')//require('http')
const mc = require('minecraft-protocol')

const config = require('./config')
const serverhost = config.host
const serverport = config.port || 25565
const dynmapfile = config.dynmap

const name = 'Dynmap to Discord'
const version = '3.0'
const wait = 10 * 1000
var serverInfo
var dynmapInfo
var timestamp = 0//420000
var playersPrev = []
var playersHash = ''

async function sendRequest(payload) {
  try {
    //console.log(payload.embeds[0])/*
    let path = config.webhook
    //payload = {"content":"gg"}
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
      console.warn('Response:\n' + response.body + ', code = ' + response.statusCode)
    }
  } catch (err) {
    console.warn('Ошибка при отправке\n' + err)
  }
}

function getServerInfo() {
  return new Promise((resolve, reject) => {
    mc.ping({ host: serverhost, port: serverport }, (err, result) => {
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
    console.warn(err)
    return {}
  }
  /*
  return new Promise((resolve, reject) => {
		http.get(dynmapfile, (res) => {
			let data = ''
			res.on('data', (chunk) => {
				data += chunk
			})
			res.on('end', () => {
				try {
					//let json = JSON.parse(data)
					resolve(JSON.parse(data))
				} catch (err) {
					reject(err)
				}
			})
		})
			.on('error', (err) => {
				reject(err)
			})
	})//*/
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
        }
      })
    }
    players.sort()
    return players
  } catch (err) {
    console.warn('Error\n' + serverInfo + '\n' + err)
  }
}

async function getUUID(name) {
  try {
    let data = await http.get('https://api.mojang.com/users/profiles/minecraft/' + name)
    let json = JSON.parse(data)
    return json.id
  } catch (err) {
    console.warn('Player not found: ' + name + '\n' + err)
    return '00000000-0000-0000-0000-000000000000'
  }
}

function sendMessage(msg) {
  const message = {
    //content : ""
    //username : ""
    //avatar_url : ""
    "embeds": [{
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
    }]
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
    if (!serverInfo) { return false }
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

    //console.log(serverInfo.description, serverInfo.players, players)
    let playersOnline = []
    let playersList = []
    players.forEach(player => {
      if (playersPrev.includes(player)) {
        playersOnline.push(player)
        playersPrev.splice(playersPrev.indexOf(player), 1)
        playersList.push(nodash(player))
        //table.insert(playersList, nodash(player))
      } else {
        playersOnline.push(player)
        playersList.unshift('__' + nodash(player) + '__')
        //table.insert(playersList, 1, '__'+nodash(player)+'__')
      }
    })
    playersPrev.forEach(player => {
      playersList.push('~~' + nodash(player) + '~~')
      //table.insert(playersList, '~~'..nodash(player)..'~~')
    })
    playersPrev = playersOnline

    //console.log(playersList.join(' '))/*
    sendMessage({
      //title = 'Список игроков',
      'message': playersList.join(' '),
      //'color': 0xffffff,
      'footer': 'Список игроков',
      'timestamp': new Date().toISOString()
    })//*/
    return true
  } catch (err) {
    console.warn('Ошибка обработки сервера\n'+serverInfo+'\n'+err)
  }
}

async function CheckDynmap() {
  try {
    dynmapInfo = await getDynmapInfo()
    if (!dynmapInfo) { return false }
    for (const event of dynmapInfo.updates) {
      if (event.timestamp > timestamp && event.type != 'tile') {
        if (event.type == 'chat') {
          console.log(event.timestamp)
          let time = new Date(event.timestamp).toISOString()
          if (event.source == 'player') {
            let player = event.account.replace(/[&]./g, '')
            let uuid = await getUUID(player.replace(/\[.*?\]/, ''))
            await sendMessage({
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
              await sendMessage({
                //"name" : 'Server',
                //"icon" : serverInfo.favicon,
                "message": event.message.substr(8),
                "color": 0xFF55FF,
                //"footer_icon": '',
                "footer": 'Server',
                "timestamp": time
              })
            }
          }
          else if (event.source == 'web') {
            await sendMessage({
              //"name" : '[Web]'..event.playerName,
              "message": event.message,
              "color": 0xffffff,
              "footer": '[Web]' + event.playerName,
              "timestamp": time
            })
          }
        }
      }
    }
    timestamp = dynmapInfo.timestamp
    return true
  } catch (err) {
    console.warn('Ошибка обработки событий\n'+dynmapInfo+'\n'+err)
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
    })//*/
    console.log('Ready ' + new Date().toISOString())
    console.log('Connected to ' + serverInfo.description.text + '\non ' + serverhost + ":" + serverport)
  } catch (err) {
    throw "Can`t connect to " + serverhost + ":" + serverport + "\n" + err
  }
}

async function Loop() {
  try {
    let stServer = await CheckServer()
    if (stServer){
      let stDynmap = await CheckDynmap()
      console.log(stServer+' '+stDynmap)
      setTimeout(Loop,wait)
    }else{
      setTimeout(Loop,wait*2)
      console.log('slow mod')
    }

  } catch (err) {
    console.warn('Ошибка в цикле\n' + err)
  }
}
//Main
(async () => {
  try {
    await Init()
    Loop()
    //CheckServer()
    //CheckDynmap()
  } catch (err) {
    throw err
  }
})()

/*
https://learn.javascript.ru/settimeout-setinterval
https://stackoverflow.com/questions/1280263/changing-the-interval-of-setinterval-while-its-running
https://stackoverflow.com/questions/46515764/how-can-i-use-async-await-at-the-top-level
*/