const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const words = require('./public/words.json');
const path = require('path');
const fs = require('fs');
let jsonRooms = [];
let rooms = [];

/* A room looks like this:
var room = {
  name: 'room1',
  htmlName: 'room1',
  players: [player1, player2],
  theDrawer: playerX,
  brushColor:'000',
  brushSize: 10,
  currentWord: 'word',
  history: [],
  timeLeft: 91,
};
*/

updateRooms();

// Magical numbers
const roundTime = 91; // in seconds
const minMessageInterval = 200; // in milliseconds
const newDrawerDelay = 1500; // in milliseconds

app.use(express.static(__dirname + '/public'));

var port = process.env.PORT || 3000;

http.listen(port, () => {
  console.log('listening on port ' + port);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/html/index.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/html/play.html'));
});

// Lower timer every second and check if time is out
setInterval(() => {
  for (let i = 0; i < rooms.length; i++) {
    rooms[i].timeLeft -= 1;

    if (rooms[i].timeLeft < 0 && rooms[i].players.length > 1) {
      if (rooms[i].currentWord !== '') {
        io.to(rooms[i].name).emit('message', {
          text: 'Time ran out! The word was "' + rooms[i].currentWord + '"', username: null, type: 'red'
        });
      }
      resetTimer(rooms[i]);
      randomizeDrawer(rooms[i]);
      io.to(rooms[i].name).emit('allowedToDraw', {
        bool:false, word:null, user:rooms[i].theDrawer
      });
      resetBrush(rooms[i]);
      randomizeWord(rooms[i]);
      setTimeout(() => {
        io.to(rooms[i].theDrawer.id).emit('allowedToDraw', {
          bool:true, word:rooms[i].currentWord, user:rooms[i].theDrawer
        });
        resetCanvas(rooms[i]);
        resetTimer(rooms[i]);
      }, newDrawerDelay);
    }
  }
}, 1000);

// Sync time every 10s
setInterval(() => {
  for (let i = 0; i < rooms.length; i++) {
    io.to(rooms[i].name).emit('timeLeft', { time:rooms[i].timeLeft });
  }
}, 10000);

io.on('connection', (socket) => {
  let messageTimestamp = Date.now();
  let userInfo;
  let currentRoom;

  socket.emit('init');
  socket.on('connectInfo', (info) => {
    if (info.room === null || info.room === '' || info.username === null || info.username === '') {
      socket.disconnect();
    } else {
      userInfo = {
        username:info.username,
        htmlusername:encodeHTML(info.username),
        id:socket.id,
        drawerPoints:0,
        guesserPoints:0,
        roomName:info.room
      };
      socket.join(userInfo.roomName);
      currentRoom = getRoom(userInfo.roomName);
      if (currentRoom !== undefined) {
        currentRoom.players.push(userInfo);
        socket.emit('history', { brushSize:currentRoom.brushSize, brushColor:currentRoom.brushColor, history:currentRoom.history });
        if (currentRoom.players.length === 2) {
          socket.emit('allowedToDraw', { bool:false, word:null, user:null });
        } else {
          socket.emit('allowedToDraw', { bool:false, word:null, user:currentRoom.theDrawer });
        }
      } else {
        currentRoom = {
          name: userInfo.roomName,
          htmlName: encodeHTML(userInfo.roomName),
          players: [userInfo],
          theDrawer: userInfo,
          brushColor: '',
          brushSize: 0,
          currentWord: '',
          history: [],
          timeLeft: 1,
          maxPoints: info.maxPoints
        }
        rooms.push(currentRoom);
        resetBrush(currentRoom);
        resetCanvas(currentRoom);
        socket.emit('message', {
          text: 'Waiting for another player', username: null, type: 'blue'
        });
        socket.broadcast.emit('message', {
          text: currentRoom.maxPoints, username: null
        });
      }
      updateRooms();
      console.log(info.username + ' connected');
      socket.to(userInfo.room).broadcast.emit('message', {
        text: userInfo.htmlusername + ' has connected', username: null
      });
      socket.emit('timeLeft', { time: currentRoom.timeLeft });
      io.to(currentRoom.name).emit('scoreBoard', currentRoom.players);
    }
  });

  socket.on('clearCanvas', (x) => {
    if (userInfo.id === currentRoom.theDrawer.id){
      resetCanvas(currentRoom);
    }
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') {
      socket.connect();
    } else if (userInfo !== undefined && userInfo.roomName !== null && userInfo.roomName !== '' && userInfo.username !== undefined && userInfo.username!== '') {
      console.log(userInfo.username + ' disconnected');
      currentRoom.players = currentRoom.players.filter(user => user.id !== userInfo.id);
      io.to(currentRoom.name).emit('scoreBoard', currentRoom.players);
      socket.to(currentRoom.name).broadcast.emit('message', {
        text: userInfo.htmlusername + ' has disconnected', username: null, type: 'red'
      });
      if (userInfo.id === currentRoom.theDrawer.id) {
        resetCanvas(currentRoom);
        resetBrush(currentRoom);
        resetTimer(currentRoom);
        // If there are people left, randomize a new drawer
        if (currentRoom.players.length > 0) {
          randomizeDrawer(currentRoom);
          socket.to(currentRoom.name).broadcast.emit('allowedToDraw', {
            bool:false, word:null, user:currentRoom.theDrawer
          });
          randomizeWord(currentRoom);
          io.to(currentRoom.theDrawer.id).emit('allowedToDraw', {
            bool:true, word:currentRoom.currentWord, user:currentRoom.theDrawer
          });
          resetTimer(currentRoom);
        } else {
          // Remove room if it is empty
          rooms = rooms.filter(room => room.name != currentRoom.name);
        }
      } else if (currentRoom.theDrawer.id === null) {
        rooms = rooms.filter(room => room.name !== currentRoom.name);
      }
      updateRooms();
    }
  });

  socket.on('message', (message) => {
    if (userInfo.id !== currentRoom.theDrawer.id && Date.now() - messageTimestamp > minMessageInterval) {
      text = encodeHTML(message.text);
      socket.to(currentRoom.name).broadcast.emit('message', { text:text, username:userInfo.username });
      socket.emit('message', { text:text, username:'You' });
      if (message.text.toLowerCase() === currentRoom.currentWord) {
        io.to(currentRoom.name).emit('message', { text: 'Correct!', user: null, type: 'green' });
        resetTimer(currentRoom);
        currentRoom.players.find(user => user.id == currentRoom.theDrawer.id).drawerPoints += 1;
        currentRoom.players.find(user => user.id == userInfo.id).guesserPoints += 1;
        io.to(currentRoom.name).emit('scoreBoard', currentRoom.players);
        if (checkWin(currentRoom, userInfo)) {
          currentRoom.theDrawer = { id:null };
          io.to(currentRoom.name).emit('allowedToDraw', { bool:false, word:null, user:null });
          currentRoom.currentWord = null;
          setTimeout(() => {
            resetBrush(currentRoom);
            resetCanvas(currentRoom);
            resetTimer(currentRoom);
            currentRoom.timeLeft = 120059;
          }, newDrawerDelay);
        } else {
          // Change drawer
          currentRoom.theDrawer = userInfo;
          io.to(currentRoom.name).emit('allowedToDraw', { bool:false, word:null, user:currentRoom.theDrawer });
          randomizeWord(currentRoom);
          setTimeout(() => {
            socket.emit('allowedToDraw', { bool:true, word: currentRoom.currentWord, user:currentRoom.theDrawer });
            resetBrush(currentRoom);
            resetCanvas(currentRoom);
            resetTimer(currentRoom);
          }, newDrawerDelay);
        }
      }
    }
    messageTimestamp = Date.now();
  });

  socket.on('stroke', (stroke) => {
    if (userInfo.id === currentRoom.theDrawer.id) {
      currentRoom.history.push(stroke);
      socket.to(currentRoom.name).broadcast.emit('stroke', stroke);
    }
  });

  socket.on('changeBrush', (brush) => {
    if (userInfo.id === currentRoom.theDrawer.id){
      currentRoom.history.push(brush);
      currentRoom.brushColor = brush.color;
      currentRoom.brushSize = brush.size;
      io.to(currentRoom.name).emit('changeBrush', { color:currentRoom.brushColor, size:currentRoom.brushSize });
    }
  });
});

// Functions
function encodeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function resetBrush(room) {
  room.brushColor = '#000000';
  room.brushSize = 10;
  io.to(room.name).emit('changeBrush', { color:room.brushColor, size:room.brushSize });
}

function resetCanvas(room) {
  io.to(room.name).emit('clearCanvas');
  room.history = [];
}

function resetTimer(room) {
  room.timeLeft = roundTime;
  io.to(room).emit('timeLeft', { time: room.timeLeft });
}

function randomizeWord(room) {
  room.currentWord = words[Math.floor(Math.random() * words.length)];
}

function randomizeDrawer(room) {
  let theNewDrawer = room.players[Math.floor(Math.random() * room.players.length)];

  while (room.theDrawer.id === theNewDrawer.id) {
    theNewDrawer = room.players[Math.floor(Math.random() * room.players.length)];
  }

  room.theDrawer = theNewDrawer;
}

function checkWin(room, guesser) {
  drawer = room.players.find(user => user.id == room.theDrawer.id);
  guesser = room.players.find(user => user.id == guesser.id);

  if (drawer.drawerPoints + drawer.guesserPoints >= room.maxPoints && guesser.drawerPoints + guesser.guesserPoints >= room.maxPoints) {
    win(room, drawer, guesser);
    return true;
  } else if (drawer.drawerPoints + drawer.guesserPoints >= room.maxPoints) {
    win(room, drawer);
    return true;
  } else if (guesser.drawerPoints + guesser.guesserPoints >= room.maxPoints) {
    win(room, guesser, null);
    return true;
  }

  return false;
}

function win(room, playerA, playerB) {
  if (playerB === null) {
    io.to(room.name).emit('message', { text:playerA.htmlusername + ' won!', user: null, type: 'purple' });
  } else {
    io.to(room.name).emit('message', {
      text: "It's a tie between " + playerA.htmlusername + ' and ' + playerB.htmlusername,
      user: null,
      type: 'purple'
    });
  }
}

function getRoom(roomName) {
  return rooms.find(roomToFind => roomToFind.name === roomName);
}

function updateRooms() {
  jsonRooms = [];
  for (var i = 0; i < rooms.length; i++) {
    jsonRooms.push({name:rooms[i].name, htmlName:rooms[i].htmlName, players:rooms[i].players.length});
  }
  const jsonData = JSON.stringify(jsonRooms);
  fs.writeFile('public/rooms.json', jsonData, (err) => err && console.log(err));
}
