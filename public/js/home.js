function Get(link) {
  const Httpreq = new XMLHttpRequest();
  Httpreq.open('GET', link, false);
  Httpreq.send(null);
  return Httpreq.responseText;
}

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

function changeMenu(nextStep) {
  const steps = { 1: document.querySelector(`.menu .step[data-step='1']`), 2: document.querySelector(`.menu .step[data-step='2']`), 3: document.querySelector(`.menu .step[data-step='3']`) };
  
  steps[1].classList.remove('active');
  steps[2].classList.remove('active');
  steps[3].classList.remove('active');

  switch (nextStep) {
    case 1:
      steps[1].classList.add('active');
      break;
    case 2:
      steps[2].classList.add('active');
      break;
    case 3:
      steps[3].classList.add('active');
      break;
    default:
      break;
  }
}

function changeName() {
  const name = document.querySelector(`input[name='name']`).value;
  sessionStorage.setItem('username', name);
}

function createRoom() {
  const roomName = document.querySelector(`input[name='room-name-1']`).value;
  const maxPoints = document.querySelector(`input[name='max-points']`).value;
  let nameIsAvailable = true;

  const rooms = JSON.parse(Get('../rooms.json'));
  for (var i = 0; i < rooms.length; i++) {
    if (roomName === rooms[i].name) {
      nameIsAvailable = false;
    }
  }

  if (roomName === '') {
    toast('error', 'Room name is empty.');
  } else if (nameIsAvailable === false) {
    toast('error', 'Room name is not available.');
  } else if (maxPoints === '') {
    toast('error', 'Points are empty.');
  } else if (isNaN(maxPoints)) {
    toast('error', 'Points must be a number.');
  } else {
    sessionStorage.setItem('room', roomName);
    sessionStorage.setItem('maxPoints', maxPoints);
    window.location.href = 'play';
  }
}

function joinRoom(roomName) {
  if (!roomName) roomName = document.querySelector(`input[name='room-name-2']`).value;
  let roomExists = false;

  const rooms = JSON.parse(Get('../rooms.json'));
  for (var i = 0; i < rooms.length; i++) {
    if (roomName.toLowerCase() === rooms[i].name.toLowerCase()) {
      sessionStorage.setItem('room', roomName);
      window.location.href = 'play';
      roomExists = true;
    }
  }

  if (roomName === '') {
    toast('error', 'Room name is empty.');
  } else if (roomExists === false) {
    toast('error', 'Room not found.');
  }
}

function refreshRooms() {
  const content = document.querySelector('.menu .content');
  content.innerHTML = '<h2>Online Rooms</h2>';

  const rooms = JSON.parse(Get('../rooms.json'));
  for (var i = 0; i < rooms.length; i++) {
    const room = document.createElement('p');
    room.innerText = rooms[i].name;
    room.onclick = (e) => joinRoom(e.target.innerText);
    content.appendChild(room);
  }

  if (rooms.length === 0) {
    const h4 = document.createElement('h4');
    h4.innerText = '-No Rooms Found-';
    content.appendChild(h4);
  }
}

function start() {
  document.querySelector(`input[name='name']`).value =   sessionStorage.getItem('username');
  refreshRooms();
}

start();
