// --- CONFIGURACIÓN GLOBAL ---
console.log("El script se ha cargado correctamente."); // Mensaje para verificar en consola

const stimuli = [
    'IRN_base2_control',
    'IRN_base2_pert8',
    'IRN_base2_pert32',
    'IRN_base32_control',
    'IRN_base32_pert2',
    'IRN_base32_pert8'
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
const radioChoiceA = document.getElementById('radio-choice-a');
const radioChoiceB = document.getElementById('radio-choice-b');
const choiceCards = document.querySelectorAll('.choice-card');
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
        
        // 1. Obtener los valores de los input tipo 'radio' seleccionados
        let genderValue = document.querySelector('input[name="gender"]:checked') ? document.querySelector('input[name="gender"]:checked').value : "";
        if (genderValue === 'Otro') {
            const otherInput = document.getElementById('q-gender-other');
            genderValue = otherInput ? (otherInput.value || 'Otro') : 'Otro';
        }

        const hearingValue = document.querySelector('input[name="hearing"]:checked') ? document.querySelector('input[name="hearing"]:checked').value : "";
        const congestionValue = document.querySelector('input[name="congestion"]:checked') ? document.querySelector('input[name="congestion"]:checked').value : "";
        const tinnitusValue = document.querySelector('input[name="tinnitus"]:checked') ? document.querySelector('input[name="tinnitus"]:checked').value : "";
        const exposureValue = document.querySelector('input[name="exposure"]:checked') ? document.querySelector('input[name="exposure"]:checked').value : "";
        const fatigueValue = document.querySelector('input[name="fatigue"]:checked') ? document.querySelector('input[name="fatigue"]:checked').value : "";
        const sensitivityValue = document.querySelector('input[name="sensitivity"]:checked') ? document.querySelector('input[name="sensitivity"]:checked').value : "";

        // 2. Almacenar los datos en el objeto questionnaireData
        questionnaireData = {
            edad: document.getElementById('q-age').value,
            genero: genderValue,
            problema_auditivo: hearingValue,
            congestion: congestionValue,
            zumbido: tinnitusValue,
            exposicion_ruido: exposureValue,
            fatiga: fatigueValue,
            sensibilidad: sensitivityValue
        };
        
        // 3. Avanzar a la Etapa 3 y cargar audios
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
            
            if (!response.ok) {
                throw new Error(`HTTP Error ${response.status}: Archivo 'audio/${s}.wav' no encontrado en el servidor.`);
            }

            const arrayBuffer = await response.arrayBuffer();
            audioBuffers[s] = await audioContext.decodeAudioData(arrayBuffer);
            console.log(`Audio cargado con éxito: ${s}.wav`);

        } catch (e) {
            console.error(`Error crítico cargando '${s}.wav':`, e);
            alert(`Atención: Hubo un error al cargar el archivo '${s}.wav'.\nDetalle: ${e.message}`);
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
    
    // Aleatorización doble
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
    
    // Desmarcar y deshabilitar radios de respuesta
    if (radioChoiceA) {
        radioChoiceA.checked = false;
        radioChoiceA.disabled = true;
    }
    if (radioChoiceB) {
        radioChoiceB.checked = false;
        radioChoiceB.disabled = true;
    }

    // Deshabilitar visualmente las tarjetas contenedoras
    choiceCards.forEach(card => card.classList.add('disabled'));

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

        // Secuencia estricta: 2.0s audio A, 1.0s silencio, 2.0s audio B
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
            // Se actualiza el texto para indicar que también se puede repetir
            if (playbackStatus) playbackStatus.textContent = "Seleccione el estímulo más molesto o vuelva a reproducir.";
            
            // Habilitar radios y remover estado deshabilitado en interfaz
            if (radioChoiceA) radioChoiceA.disabled = false;
            if (radioChoiceB) radioChoiceB.disabled = false;
            choiceCards.forEach(card => card.classList.remove('disabled'));
            if (choiceControls) choiceControls.classList.remove('disabled');
            
            // NUEVO: Habilitar de nuevo el botón de reproducción
            if (btnPlayTrial) btnPlayTrial.disabled = false;
            
        }, 5000); 
    });
}

function handleChoice(choice) {
    const currentPair = trials[currentTrialIndex];
    const winner = choice === 'A' ? currentPair[0] : currentPair[1];
    const loser = choice === 'A' ? currentPair[1] : currentPair[0];

    // Registrar resultado en la matriz bidimensional
    resultsMatrix[winner][loser] = 1;
    resultsMatrix[loser][winner] = 0;

    currentTrialIndex++;
    if (currentTrialIndex < trials.length) {
        updateTrialUI();
    } else {
        showStage(5);
    }
}

// Escuchadores de evento al cambiar el radio button
if (radioChoiceA) radioChoiceA.addEventListener('change', () => handleChoice('A'));
if (radioChoiceB) radioChoiceB.addEventListener('change', () => handleChoice('B'));

// --- EXPORTACIÓN DE DATOS ---
if (btnExport) {
    btnExport.addEventListener('click', async () => {
        const payload = {
            id: sessionId,
            startTime: startTime || new Date().toLocaleString("es-AR"),
            demographics: questionnaireData,
            matrix: resultsMatrix
        };

        if (exportStatus) {
            exportStatus.style.color = "#0056b3";
            exportStatus.textContent = "Guardando respuestas en la base de datos...";
        }
        btnExport.disabled = true;

        try {
            await fetch(GOOGLE_SHEETS_WEBHOOK, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (exportStatus) {
                exportStatus.style.color = "#28a745";
                exportStatus.textContent = "Respuestas guardadas correctamente. Ya puede cerrar esta ventana.";
            }
        } catch (e) {
            if (exportStatus) {
                exportStatus.style.color = "#dc3545";
                exportStatus.textContent = "Error de conexión. Intente enviar nuevamente.";
            }
            btnExport.disabled = false;
        }
    });
}
