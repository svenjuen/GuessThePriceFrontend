const socket = new WebSocket("ws://localhost:8080");
let playerId = null;
let currentGameState = null;

// DOM elements
const joinScreen = document.getElementById('join-screen');
const gameContainer = document.getElementById('game-container');
const playerNameInput = document.getElementById('player-name');
const joinBtn = document.getElementById('join-btn');
const startBtn = document.getElementById('start-btn');
const playersList = document.getElementById('players-list');
const currentGuessDisplay = document.getElementById('current-guess-display');

// Game phase containers
const waitingPhase = document.getElementById('waiting-phase');
const showingPhase = document.getElementById('showing-phase');
const guessingPhase = document.getElementById('guessing-phase');
const resultsPhase = document.getElementById('results-phase');

// Timer displays
const showingTimer = document.getElementById('timer');
const guessingTimer = document.getElementById('timer-guess');
const resultsTimer = document.getElementById('timer-results');

// Item displays
const itemImage = document.getElementById('item-image');
const itemImageGuess = document.getElementById('item-image-guess');
const itemImageResults = document.getElementById('item-image-results');
const itemDesc = document.getElementById('item-description');
const itemDescGuess = document.getElementById('item-description-guess');
const actualPrice = document.getElementById('actual-price');

// Guess input
const guessInput = document.getElementById('guess-input');
const submitGuess = document.getElementById('submit-guess');

// Results display
const resultsDiv = document.getElementById('results');

// Event listeners
joinBtn.addEventListener('click', joinGame);
startBtn.addEventListener('click', () => {
  socket.send(JSON.stringify({ type: 'start' }));
});
submitGuess.addEventListener('click', submitPlayerGuess);

// Optimierte Bilderlade-Funktion
function loadImageIfChanged(imgElement, newSrc) {
  if (imgElement.dataset.currentSrc !== newSrc) {
    imgElement.src = newSrc;
    imgElement.dataset.currentSrc = newSrc;
    
    imgElement.onload = function() {
      // Wieder einblenden mit Animation
      imgElement.style.transition = 'opacity 0.3s ease';
      imgElement.style.opacity = '1';
      
      // Konsistente Größe erzwingen
      imgElement.style.width = '300px';
      imgElement.style.height = '300px';
    };
  }
}

function joinGame() {
  const name = playerNameInput.value.trim();
  if (name.length < 2) {
    alert('Bitte gib einen Namen ein (mind. 2 Zeichen)');
    return;
  }
  
  socket.send(JSON.stringify({
    type: 'join',
    name: name
  }));
}

function submitPlayerGuess() {
  const guess = guessInput.value.trim();
  if (!guess) {
    alert('Bitte gib einen Preis ein');
    return;
  }
  
  // Aktuellen Guess anzeigen
  currentGuessDisplay.textContent = `Aktuelle Schätzung: $${parseFloat(guess).toFixed(2)}`;
  
  socket.send(JSON.stringify({
    type: 'guess',
    guess: parseFloat(guess)
  }));
  
  submitGuess.disabled = true;
}


guessInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitPlayerGuess();
  }
});

// WebSocket handler
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'welcome':
      playerId = data.playerId;
      joinScreen.style.display = 'none';
      gameContainer.style.display = 'block';
      break;
      
    case 'players':
      updatePlayersList(data.players);
      break;
      
    case 'update':
      currentGameState = data.gameState;
      smoothUpdateGame();
      break;
      
    case 'timerUpdate': // Nur für Timer-Updates
      if (currentGameState) {
        currentGameState.timeRemaining = data.timeRemaining;
        updateTimers();
      }
      break;
  }
});

function updatePlayersList(players) {
  playersList.innerHTML = '';
  
  players.forEach(player => {
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    
    if (player.id === playerId) {
      playerCard.style.border = '2px solid #3498db';
    }
    
    playerCard.innerHTML = `
      <div class="player-name">${player.name}</div>
      <div class="player-score">${player.score} pts</div>
    `;
    
    playersList.appendChild(playerCard);
  });
}

// Haupt-Update-Funktion (flackert nicht)
function smoothUpdateGame() {
  if (!currentGameState) return;

  const currentPhase = currentGameState.phase;
  const prevPhase = document.body.dataset.currentPhase;

  // Nur bei Phasenwechsel komplett updaten
  if (prevPhase !== currentPhase) {
    // Alle Phasen verstecken
    waitingPhase.style.display = 'none';
    showingPhase.style.display = 'none';
    guessingPhase.style.display = 'none';
    resultsPhase.style.display = 'none';

    // Aktuelle Phase anzeigen
    document.getElementById(`${currentPhase}-phase`).style.display = 'block';
    document.body.dataset.currentPhase = currentPhase;

    // Phasenspezifische Updates
    switch (currentPhase) {
      case 'showing':
        loadImageIfChanged(itemImage, `images/${currentGameState.currentItem.img}`);
        itemDesc.textContent = currentGameState.currentItem.desc;
        break;
        
      case 'guessing':
        loadImageIfChanged(itemImageGuess, `images/${currentGameState.currentItem.img}`);
        itemDescGuess.textContent = currentGameState.currentItem.desc;
        guessInput.focus();
        submitGuess.disabled = false;
        break;
        
      case 'results':
        loadImageIfChanged(itemImageResults, `images/${currentGameState.currentItem.img}`);
        actualPrice.textContent = currentGameState.currentItem.price.toFixed(2);
        showResults();
        break;
    }
  }

  // Timer immer aktualisieren
  updateTimers();
}

// Timer separat updaten (kein Flackern)
function updateTimers() {
  showingTimer.textContent = `Start in: ${currentGameState.timeRemaining}`;
  guessingTimer.textContent = `Verbleibende Zeit: ${currentGameState.timeRemaining}`;
  resultsTimer.textContent = `Nächste Runde in: ${currentGameState.timeRemaining}`;
}

function showResults() {
  if (!currentGameState?.players) return;
  
  const sortedPlayers = [...currentGameState.players].sort((a, b) => {
    if (a.lastDiff === null) return 1;
    if (b.lastDiff === null) return -1;
    return a.lastDiff - b.lastDiff;
  });
  
  resultsDiv.innerHTML = '';
  
  sortedPlayers.forEach((player, index) => {
    if (player.lastDiff === null) return;
    
    const row = document.createElement('div');
    row.className = `result-row ${index === 0 ? 'winner' : ''}`;
    
    row.innerHTML = `
      <span>${player.name}</span>
      <span>Schätzung: $${player.currentGuess.toFixed(2)}</span>
      <span>Differenz: $${player.lastDiff.toFixed(2)}</span>
      <span>+${player.score - (currentGameState.players.find(p => p.id === player.id)?.previousScore || 0)} Punkte</span>
    `;
    
    resultsDiv.appendChild(row);
  });
}