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

const GOOGLE_SHEETS_WEBHOOK = "TU_URL_DE_GOOGLE_APPS_SCRIPT";

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
            demographics: questionnaireData,
            matrix: resultsMatrix
        };

        generateCSV();

        if (exportStatus) exportStatus.textContent = "Enviando respuestas...";
        try {
            await fetch(GOOGLE_SHEETS_WEBHOOK, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (exportStatus) exportStatus.textContent = "Respuestas enviadas correctamente. Ya puede cerrar esta ventana.";
        } catch (e) {
            if (exportStatus) exportStatus.textContent = "Error de red al enviar datos. El archivo fue descargado localmente por seguridad.";
        }
    });
}

function generateCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Cabecera Demográfica
    csvContent += "ID,Edad,Genero,ProbAuditivo,Congestion,Zumbido,ExpRuido,Fatiga,Sensibilidad\n";
    csvContent += `${sessionId},${Object.values(questionnaireData).join(',')}\n\n`;
    
    // Matriz Dinámica con Nombres de Archivos Reales
    csvContent += `Matriz de Preferencia (1=Mas molesto),${stimuli.join(',')}\n`;
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
