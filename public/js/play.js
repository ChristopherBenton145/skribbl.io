const socket = io();

// Canvas variables
const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
let canvasResolution = 1000;
canvas.width = canvasResolution * 1.4;
canvas.height = canvasResolution;
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.lineWidth = 10;
ctx.strokeStyle = '#000';

// Variables
const container = document.querySelector('.container');
const chat = document.querySelector('.chat');
const chatContext = document.querySelector('.chat .context');
const chatText = document.querySelector('.chat input');
const users = document.querySelector('.users');
const timer = document.querySelector('.toolkit .time');
let currentWord = null;
let isDrawing = false;
let canDraw = false;
let timeLeft = -10;
let lastX = 0;
let lastY = 0;
let username;

function toast(type, text) {
  let color = '';

  switch (type) {
    case 'success':
      color = 'linear-gradient(to right, #11998e, #38ef7d)';
      break;
    case 'warning':
      color = 'linear-gradient(to right, #F2994A, #F2C94C)';
      break;
    case 'error':
      color = 'linear-gradient(to right, #f85032, #e73827)';
      break;
    default:
      break;
  }

  Toastify({ text: text, duration: 2000, close: true, gravity: 'top', position: 'left', stopOnFocus: true, style: { background: color} }).showToast();
}

// Event Listeners

canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  [lastX, lastY] = [make_relative(e.offsetX), make_relative(e.offsetY)];
  draw(e);
});
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);

canvas.addEventListener('touchstart', (e) => {
  const offset = canvas.getBoundingClientRect();

  isDrawing = true;
  lastX = make_relative(e.touches[0].clientX-offset.left);
  lastY = make_relative(e.touches[0].clientY-offset.top);
  draw(e);
});
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', () => isDrawing = false);
canvas.addEventListener('touchcancel', () => isDrawing = false);
canvas.addEventListener('mouseout', () => isDrawing = false);
chatText.addEventListener('keydown', (e) => e.keyCode === 0x0D && send());

function draw(e) {
  // stop the function if they are not mouse down or if not allowed to draw
  if (!isDrawing || !canDraw) return;

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);

  if (e.touches != undefined) {
    const offset = canvas.getBoundingClientRect();
    newX = make_relative(e.touches[0].clientX-offset.left);
    newY = make_relative(e.touches[0].clientY-offset.top);
  } else {
    newX = make_relative(e.offsetX);
    newY = make_relative(e.offsetY);
  }

  ctx.lineTo(newX, newY);
  socket.emit('stroke', { lastX:lastX, lastY:lastY, offsetX:newX, offsetY:newY });
  ctx.stroke();
  [lastX, lastY] = [newX, newY];
}

//adapt strokes for current canvas size
function make_relative (a) {
  return a * canvasResolution / canvas.clientHeight;
}

function changeColor() {
  const newColor = document.querySelector('.toolkit .color').value;
  socket.emit('changeBrush', {color:newColor, size:ctx.lineWidth});
}

function clearCanvas() {
  socket.emit('clearCanvas');
}

function addToChat(text, user = null, type) {
  const p = document.createElement('p');
  p.innerText = text;
  type && p.classList.add(type);

  if (user !== null) {
    const span = document.createElement('span');
    span.innerText = user + ': ';
    p.prepend(span);
  }

  chatContext.prepend(p);
}

function send() {
  if (chatText.value !== '') {
    socket.emit('message', { text:chatText.value, username:username });
    chatText.value = '';
  }
}

// Socket Listeners

socket.on('history', (conf) => {
  ctx.clearRect(0, 0, (canvas.width), (canvas.height));

  for (var i = 0; i < conf.history.length; i++){
    event = conf.history[i];

    if (event.lastX !== undefined) {
      ctx.beginPath();
      ctx.moveTo(event.lastX, event.lastY);
      ctx.lineTo(event.offsetX, event.offsetY);
      ctx.stroke();
    } else {
      ctx.strokeStyle =  event.color;
      ctx.lineWidth =  event.size;
    }
  }

  ctx.lineWidth = conf.brushSize;
  ctx.strokeStyle = conf.brushColor;
});

socket.on('disconnect', (reason) => {
  addToChat('You have disconnected', null, 'red');
});

// If you are the drawer show brush tools, otherwise hide them
socket.on('allowedToDraw', (allowedToDraw) => {
  canDraw = allowedToDraw.bool;

  if (canDraw) {
    currentWord = allowedToDraw.word;
    container.classList.add('can-draw');
    addToChat('You are drawing: ' + currentWord, null, 'green');
  } else {
    currentWord = null;

    container.classList.remove('can-draw');

    if (allowedToDraw.user != null) {
      addToChat(allowedToDraw.user.htmlusername + ' is drawing', null, 'green');
    }
  }
});

socket.on('stroke', function(stroke){
  ctx.beginPath();
  ctx.moveTo(stroke.lastX, stroke.lastY);
  ctx.lineTo(stroke.offsetX, stroke.offsetY);
  ctx.stroke();
  [lastX, lastY] = [stroke.offsetX, stroke.offsetY];
});

socket.on('clearCanvas', (clear) => {
  ctx.clearRect(0, 0, (canvas.width), (canvas.height))
});

socket.on('changeBrush', (brush) => {
  ctx.strokeStyle = brush.color;
  ctx.lineWidth = brush.size;
});

socket.on('message', (message) => {
  addToChat(message.text, message.username, message.type);
});

socket.on('timeLeft', (time) => {
  timeLeft = time.time;
});

socket.on('scoreBoard', (scoreBoard) => {
  users.innerHTML = '';

  for (var i = 0; i < scoreBoard.length; i++) {
    const div = document.createElement('div');
    const name = document.createElement('p');
    const points = document.createElement('p');
    name.innerHTML = scoreBoard[i].htmlusername;
    points.innerHTML = (scoreBoard[i].drawerPoints + scoreBoard[i].guesserPoints);
    name.classList.add('name');
    points.classList.add('points');
    div.appendChild(name);
    div.appendChild(points);
    users.appendChild(div);
  }
});

window.onresize = () => {
  chat.style.height = `${canvas.clientHeight}px`;
};

function start() {
  const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
  
  username = sessionStorage.getItem('username') || `Anonymous${randomRange(100, 999)}`;
  socket.on('init', () => socket.emit('connectInfo', { username:username, room:sessionStorage.getItem('room'), maxPoints:sessionStorage.getItem('maxPoints') }));
  chat.style.height = `${canvas.clientHeight}px`;

  setInterval(() => {
    timeLeft -= 1;
    if (!(timeLeft < -0)) timer.innerHTML = '0'+(Math.floor(timeLeft / 60)) + ':' + (('0'+(Math.floor(timeLeft % 60))).slice(-2));
  }, 1000);
}

start();
