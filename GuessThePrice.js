// Verbindung zum WebSocket-Server herstellen
const socket = new WebSocket("ws://localhost:8080");
let playerId = null; // Unsere Spieler-ID
let currentGameState = null; // Aktueller Spielzustand

// DOM-Elemente schnappen
const joinScreen = document.getElementById('join-screen');
const gameContainer = document.getElementById('game-container');
const playerNameInput = document.getElementById('player-name');
const joinBtn = document.getElementById('join-btn');
const startBtn = document.getElementById('start-btn');
const playersList = document.getElementById('players-list');

// Spielphasen-Container
const waitingPhase = document.getElementById('waiting-phase');
const showingPhase = document.getElementById('showing-phase');
const guessingPhase = document.getElementById('guessing-phase');
const resultsPhase = document.getElementById('results-phase');

// Timer-Anzeigen
const showingTimer = document.getElementById('timer');
const guessingTimer = document.getElementById('timer-guess');
const resultsTimer = document.getElementById('timer-results');

// Artikel-Anzeigen
const itemImage = document.getElementById('item-image');
const itemImageGuess = document.getElementById('item-image-guess');
const itemImageResults = document.getElementById('item-image-results');
const itemDesc = document.getElementById('item-description');
const itemDescGuess = document.getElementById('item-description-guess');
const actualPrice = document.getElementById('actual-price');

// Rate-Eingabe
const guessInput = document.getElementById('guess-input');
const submitGuess = document.getElementById('submit-guess');

// Ergebnis-Anzeige
const resultsDiv = document.getElementById('results');

// Event Listener für Buttons
joinBtn.addEventListener('click', joinGame);
startBtn.addEventListener('click', () => {
  socket.send(JSON.stringify({ type: 'start' }));
});
submitGuess.addEventListener('click', submitPlayerGuess);

// Spiel beitreten
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

// Preis schätzen
function submitPlayerGuess() {
  const guess = guessInput.value.trim();
  if (!guess) {
    alert('Bitte gib einen Preis ein');
    return;
  }
  
  socket.send(JSON.stringify({
    type: 'guess',
    guess: guess
  }));
  
  submitGuess.disabled = true; // Mehrfachklicks verhindern
}

// Enter-Taste zum Abschicken nutzen
guessInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitGuess.click();
  }
});

// WebSocket-Nachrichten verarbeiten
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'welcome': // Wir sind beigetreten
      playerId = data.playerId;
      joinScreen.style.display = 'none';
      gameContainer.style.display = 'block';
      break;
      
    case 'players': // Spielerliste wurde aktualisiert
      updatePlayersList(data.players);
      break;
      
    case 'update': // Spielzustand hat sich geändert
      currentGameState = data.gameState;
      updateGameDisplay();
      break;
  }
});

// Spielerliste aktualisieren
function updatePlayersList(players) {
  playersList.innerHTML = ''; // Alte Liste leeren
  
  // Für jeden Spieler eine Karte erstellen
  players.forEach(player => {
    const playerCard = document.createElement('div');
    playerCard.className = 'player-card';
    
    // Unsere eigene Karte markieren
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

// Spielanzeige aktualisieren
function updateGameDisplay() {
  if (!currentGameState) return;
  
  // Aktuelle Eingabe merken (wird sonst bei Updates gelöscht)
  const currentGuess = guessInput.value;
  
  // Alle Phasen erstmal verstecken
  waitingPhase.style.display = 'none';
  showingPhase.style.display = 'none';
  guessingPhase.style.display = 'none';
  resultsPhase.style.display = 'none';
  
  // Aktuelle Phase anzeigen
  switch (currentGameState.phase) {
    case 'waiting': // Warten auf Spielstart
      waitingPhase.style.display = 'block';
      startBtn.disabled = currentGameState.players.length < 2;
      break;
      
    case 'showing': // Artikel wird angezeigt
      showingPhase.style.display = 'block';
      itemImage.src = `images/${currentGameState.currentItem.img}`;
      itemDesc.textContent = currentGameState.currentItem.desc;
      showingTimer.textContent = `Start in: ${currentGameState.timeRemaining}`;
      break;
      
    case 'guessing': // Ratephase
      guessingPhase.style.display = 'block';
      itemImageGuess.src = `images/${currentGameState.currentItem.img}`;
      itemDescGuess.textContent = currentGameState.currentItem.desc;
      guessingTimer.textContent = `Verbleibende Zeit: ${currentGameState.timeRemaining}`;
      guessInput.value = currentGuess || ''; // Eingabe wiederherstellen
      guessInput.focus(); // Cursor ins Eingabefeld
      submitGuess.disabled = false;
      break;
      
    case 'results': // Ergebnisse anzeigen
      resultsPhase.style.display = 'block';
      itemImageResults.src = `images/${currentGameState.currentItem.img}`;
      actualPrice.textContent = currentGameState.currentItem.price.toFixed(2);
      resultsTimer.textContent = `Nächste Runde in: ${currentGameState.timeRemaining}`;
      showResults();
      break;
  }
}
 
// Ergebnisse anzeigen
function showResults() {
  if (!currentGameState?.players) return;
  
  // Spieler nach Treffernahne sortieren (beste zuerst)
  const sortedPlayers = [...currentGameState.players].sort((a, b) => {
    if (a.lastDiff === null) return 1;
    if (b.lastDiff === null) return -1;
    return a.lastDiff - b.lastDiff;
  });
  
  resultsDiv.innerHTML = ''; // Alte Ergebnisse löschen
  
  // Ergebniszeilen erstellen
  sortedPlayers.forEach((player, index) => {
    if (player.lastDiff === null) return; // Wer nicht geraten hat
    
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