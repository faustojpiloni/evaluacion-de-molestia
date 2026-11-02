// Configuración Global y Estado
const stimuli = ['S1', 'S2', 'S3', 'S7', 'S8', 'S9'];
let audioBuffers = {};
let audioContext;
let sessionId = `Sujeto_${new Date().toISOString().replace(/[-:T]/g, '').slice(0,14)}`;
let questionnaireData = {};
let trials = [];
let currentTrialIndex = 0;
let resultsMatrix = {};

// Webhook de Google Sheets (Reemplazar con el endpoint real)
const GOOGLE_SHEETS_WEBHOOK = "TU_URL_DE_GOOGLE_APPS_SCRIPT";

// Elementos del DOM
const stages = document.querySelectorAll('.stage');
const statusIndicator = document.getElementById('status-indicator');
const btnPlayPair = document.getElementById('btn-play-pair');
const btnChoiceA = document.getElementById('btn-choice-a');
const btnChoiceB = document.getElementById('btn-choice-b');
const trialCounter = document.getElementById('trial-counter');

// Navegación de Etapas
function showStage(stageNumber) {
    stages.forEach((s, idx) => {
        if (idx + 1 === stageNumber) s.classList.add('active');
        else s.classList.remove('active');
    });
}

document.getElementById('btn-start-quest').addEventListener('click', () => {
    showStage(2);
    initAudioContext(); // Inicializar AudioContext por interacción del usuario
});

document.getElementById('questionnaire-form').addEventListener('submit', (e) => {
    e.preventDefault();
    questionnaireData = {
        edad: document.getElementById('q-age').value,
        genero: document.getElementById('q-gender').value,
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

document.getElementById('btn-test-audio').addEventListener('click', () => {
    playBuffer(audioBuffers[stimuli[0]]); // Reproduce un sonido de prueba
});

document.getElementById('btn-start-test').addEventListener('click', () => {
    setup2AFC();
    showStage(4);
});

// Audio y Carga
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

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

// Lógica 2AFC
function setup2AFC() {
    trials = [];
    // 1. Generar 15 pares únicos
    for (let i = 0; i < stimuli.length; i++) {
        for (let j = i + 1; j < stimuli.length; j++) {
            trials.push([stimuli[i], stimuli[j]]);
        }
    }
    // 2. Aleatorización doble
    trials = trials.sort(() => Math.random() - 0.5); // Orden de los pares
    trials = trials.map(pair => Math.random() > 0.5 ? [pair[0], pair[1]] : [pair[1], pair[0]]); // Orden interno A/B

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
    trialCounter.textContent = `${currentTrialIndex + 1} de 15`;
    btnChoiceA.disabled = true;
    btnChoiceB.disabled = true;
    btnPlayPair.disabled = false;
    statusIndicator.textContent = "Presione reproducir para escuchar los estímulos.";
}

btnPlayPair.addEventListener('click', async () => {
    btnPlayPair.disabled = true;
    const currentPair = trials[currentTrialIndex];
    const bufferA = audioBuffers[currentPair[0]];
    const bufferB = audioBuffers[currentPair[1]];

    // Secuencia estricta de tiempo[cite: 15]
    statusIndicator.textContent = "Reproduciendo Estímulo A...";
    playBuffer(bufferA);
    
    setTimeout(() => {
        statusIndicator.textContent = "Silencio...";
    }, 2000); // Fin de A (2s)

    setTimeout(() => {
        statusIndicator.textContent = "Reproduciendo Estímulo B...";
        playBuffer(bufferB);
    }, 3000); // Inicio B (2s A + 1s Silencio)

    setTimeout(() => {
        statusIndicator.textContent = "Seleccione el estímulo más molesto.";
        btnChoiceA.disabled = false;
        btnChoiceB.disabled = false;
    }, 5000); // Fin B (3000ms + 2000ms)
});

function handleChoice(choice) {
    const currentPair = trials[currentTrialIndex];
    const winner = choice === 'A' ? currentPair[0] : currentPair[1];
    const loser = choice === 'A' ? currentPair[1] : currentPair[0];

    // Registrar en matriz f_ij (1 si i es más molesto que j)
    resultsMatrix[winner][loser] = 1;
    resultsMatrix[loser][winner] = 0;

    currentTrialIndex++;
    if (currentTrialIndex < trials.length) {
        updateTrialUI();
    } else {
        showStage(5);
    }
}

btnChoiceA.addEventListener('click', () => handleChoice('A'));
btnChoiceB.addEventListener('click', () => handleChoice('B'));

// Exportación de Datos
document.getElementById('btn-export').addEventListener('click', async () => {
    const payload = {
        id: sessionId,
        demographics: questionnaireData,
        matrix: resultsMatrix
    };

    // 1. Descarga Local CSV
    generateCSV();

    // 2. Envío a Google Sheets
    const statusTxt = document.getElementById('export-status');
    statusTxt.textContent = "Enviando datos a la nube...";
    try {
        await fetch(GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        statusTxt.textContent = "Datos enviados correctamente.";
    } catch (e) {
        statusTxt.textContent = "Error al enviar a la nube. Su CSV fue descargado.";
    }
});

function generateCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    // Cabecera Demográfica
    csvContent += "ID,Edad,Genero,ProbAuditivo,Congestion,Zumbido,ExpRuido,Fatiga,Sensibilidad\n";
    csvContent += `${sessionId},${Object.values(questionnaireData).join(',')}\n\n`;
    
    // Matriz
    csvContent += "Matriz de Preferencia (1=Mas molesto),S1,S2,S3,S7,S8,S9\n";
    stimuli.forEach(row => {
        let rowData = [row];
        stimuli.forEach(col => {
            rowData.push(resultsMatrix[row][col]);
        });
        csvContent += rowData.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Resultado_Anonimo_${sessionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
