// --- CONFIGURACIÓN GLOBAL ---
console.log("El script se ha cargado correctamente."); // Mensaje para verificar en consola

const stimuli = [
    'IRN_base2_control',
    'IRN_base2_pert8',
    'IRN_base2_pert32',
    'IRN_base32_control',
    'IRN_base32_pert2',
    'IRN_base22_pert32'
];

let audioBuffers = {};
let audioContext;
let sessionId = `Sujeto_${new Date().toISOString().replace(/[-:T]/g, '').slice(0,14)}`;
let questionnaireData = {};
let trials = [];
let currentTrialIndex = 0;
let resultsMatrix = {};
let startTime = ""; // Variable para capturar la hora de inicio

// URL del Webhook de Google Apps Script actualizada
const GOOGLE_SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbxg6nhWov3S1D381Qvl-XMnWsGnUuV4hPusOorK2CRHInSviea9rKHGy-PhUU1MLfKp/exec";

// --- ELEMENTOS DEL DOM ---
const stages = document.querySelectorAll('.stage');
const btnStart = document.getElementById('btn-start');
const screeningForm = document.getElementById('screening-form');
const btnStartTest = document.getElementById('btn-start-test');
const btnPlayTrial = document.getElementById('btn-play-trial');
const playbackStatus = document.getElementById('playback-status');
const choiceControls = document.getElementById('choice-controls');
const btnChoiceA = document.getElementById('btn-choice-a');
const btnChoiceB = document.getElementById('btn-choice-b');
const trialCounter = document.getElementById('trial-counter');
const btnExport = document.getElementById('btn-export');
const exportStatus = document.getElementById('export-status');

// --- NAVEGACIÓN ---
function showStage(stageNumber) {
    stages.forEach((s, idx) => {
        if (idx + 1 === stageNumber) {
            s.classList.remove('hidden');
            s.classList.add('active');
        } else {
            s.classList.remove('active');
            s.classList.add('hidden');
        }
    });
}

// ETAPA 1 -> 2
if (btnStart) {
    btnStart.addEventListener('click', () => {
        // Capturar fecha y hora de inicio exactas
        startTime = new Date().toLocaleString("es-AR");
        
        showStage(2);
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    });
}

// ETAPA 2 -> 3
if (screeningForm) {
    screeningForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        let genderValue = document.getElementById('q-gender').value;
        if (genderValue === 'Otro') {
            const otherInput = document.getElementById('q-gender-other');
            genderValue = otherInput ? (otherInput.value || 'Otro') : 'Otro';
        }

        questionnaireData = {
            edad: document.getElementById('q-age').value,
            genero: genderValue,
            problema_auditivo: document.getElementById('q-hearing').value,
            congestion: document.getElementById('q-congestion').value,
            zumbido: document.getElementById('q-tinnitus').value,
            exposicion_ruido: document.getElementById('q-exposure').value,
            fatiga: document.getElementById('q-fatigue').value,
            sensibilidad: document.getElementById('q-sensitivity').value
        };
        
        showStage(3);
        loadAllAudio();
    });
}

// ETAPA 3 -> 4
if (btnStartTest) {
    btnStartTest.addEventListener('click', () => {
        setup2AFC();
        showStage(4);
    });
}

// --- AUDIO Y CARGA ---
async function loadAllAudio() {
    for (let s of stimuli) {
        try {
            const response = await fetch(`audio/${s}.wav`);
            const arrayBuffer = await response.arrayBuffer();
            audioBuffers[s] = await audioContext.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error(`Error cargando ${s}.wav`, e);
        }
    }
}

function playBuffer(buffer) {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    return source;
}

// --- LÓGICA 2AFC ---
function setup2AFC() {
    trials = [];
    for (let i = 0; i < stimuli.length; i++) {
        for (let j = i + 1; j < stimuli.length; j++) {
            trials.push([stimuli[i], stimuli[j]]);
        }
    }
    
    // Aleatorización
    trials = trials.sort(() => Math.random() - 0.5); 
    trials = trials.map(pair => Math.random() > 0.5 ? [pair[0], pair[1]] : [pair[1], pair[0]]);

    // Inicializar matriz 6x6
    stimuli.forEach(s1 => {
        resultsMatrix[s1] = {};
        stimuli.forEach(s2 => {
            resultsMatrix[s1][s2] = (s1 === s2) ? 'N/A' : null;
        });
    });
    
    updateTrialUI();
}

function updateTrialUI() {
    if (trialCounter) trialCounter.textContent = `${currentTrialIndex + 1}`;
    if (btnChoiceA) btnChoiceA.disabled = true;
    if (btnChoiceB) btnChoiceB.disabled = true;
    if (btnPlayTrial) btnPlayTrial.disabled = false;
    if (playbackStatus) playbackStatus.textContent = "Presione reproducir para escuchar los estímulos.";
    if (choiceControls) choiceControls.classList.add('disabled');
}

if (btnPlayTrial) {
    btnPlayTrial.addEventListener('click', () => {
        btnPlayTrial.disabled = true;
        const currentPair = trials[currentTrialIndex];
        const bufferA = audioBuffers[currentPair[0]];
        const bufferB = audioBuffers[currentPair[1]];

        // Secuencia estricta: 2.0s de audio, 1.0s silencio, 2.0s de audio
        if (playbackStatus) playbackStatus.textContent = "Reproduciendo Estímulo A...";
        if (bufferA) playBuffer(bufferA);
        
        setTimeout(() => {
            if (playbackStatus) playbackStatus.textContent = "Silencio...";
        }, 2000); 

        setTimeout(() => {
            if (playbackStatus) playbackStatus.textContent = "Reproduciendo Estímulo B...";
            if (bufferB) playBuffer(bufferB);
        }, 3000); 

        setTimeout(() => {
            if (playbackStatus) playbackStatus.textContent = "Seleccione el estímulo más molesto.";
            if (btnChoiceA) btnChoiceA.disabled = false;
            if (btnChoiceB) btnChoiceB.disabled = false;
            if (choiceControls) choiceControls.classList.remove('disabled');
        }, 5000); 
    });
}

function handleChoice(choice) {
    const currentPair = trials[currentTrialIndex];
    const winner = choice === 'A' ? currentPair[0] : currentPair[1];
    const loser = choice === 'A' ? currentPair[1] : currentPair[0];

    // Matriz f_ij
    resultsMatrix[winner][loser] = 1;
    resultsMatrix[loser][winner] = 0;

    currentTrialIndex++;
    if (currentTrialIndex < trials.length) {
        updateTrialUI();
    } else {
        showStage(5);
    }
}

if (btnChoiceA) btnChoiceA.addEventListener('click', () => handleChoice('A'));
if (btnChoiceB) btnChoiceB.addEventListener('click', () => handleChoice('B'));

// --- EXPORTACIÓN DE DATOS ---
if (btnExport) {
    btnExport.addEventListener('click', async () => {
        const payload = {
            id: sessionId,
            startTime: startTime, // Se envía la hora de inicio capturada
            demographics: questionnaireData,
            matrix: resultsMatrix
        };

        if (exportStatus) exportStatus.textContent = "Guardando respuestas en la base de datos...";
        if (btnExport) btnExport.disabled = true; // Bloquea el botón para evitar clics dobles

        try {
            await fetch(GOOGLE_SHEETS_WEBHOOK, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (exportStatus) {
                exportStatus.style.color = "#28a745"; // Color verde de éxito
                exportStatus.textContent = "Respuestas guardadas correctamente. Ya puede cerrar esta ventana.";
            }
        } catch (e) {
            if (exportStatus) {
                exportStatus.style.color = "#dc3545"; // Color rojo de error
                exportStatus.textContent = "Error de conexión. Intente enviar nuevamente.";
            }
            if (btnExport) btnExport.disabled = false;
        }
    });
}
