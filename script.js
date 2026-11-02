// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const WEBHOOK_URL = 'https://script.google.com/macros/s/TU_WEBHOOK_AQUI/exec'; // Reemplazar con URL de Google Apps Script
const STIMULI = ['S1', 'S2', 'S3', 'S7', 'S8', 'S9'];
let audioContext;
let audioBuffers = {};
let trials = [];
let currentTrialIndex = 0;
let resultsMatrix = {};
let sessionData = {
    id: `Sujeto_${new Date().toISOString().replace(/[-:T]/g, '').slice(0,1La estructura de archivos para el repositorio en GitHub Pages constará de una carpeta raíz con los archivos principales de la aplicación y un subdirectorio para los estímulos acústicos.

**Estructura del Repositorio:**
*   `index.html` (Vista principal y maquetación de las 5 etapas)
*   `styles.css` (Diseño de la interfaz)
*   `script.js` (Lógica de control, Web Audio API, matriz de resultados y exportación)
*   `audio/` (Directorio para `S1.wav`, `S2.wav`, `S3.wav`, `S7.wav`, `S8.wav`, `S9.wav`)
*   `README.md` (Documentación técnica)

### 1. `index.html`
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Evaluación Psicoacústica de Estímulos Sonoros - UNTREF</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="app-container">
        <!-- ETAPA 1: Bienvenida -->
        <section id="stage-1" class="stage active">
            <h1>Evaluación Psicoacústica de Estímulos Sonoros - UNTREF</h1>
            <p>Le pedimos que evalúe la molestia auditiva de los siguientes sonidos imaginando que se encuentra en su hogar, en un momento de descanso o relajación.</p>
            <button id="btn-start-quest">Comenzar Cuestionario Anónimo</button>
        </section>

        <!-- ETAPA 2: Cuestionario -->
        <section id="stage-2" class="stage">
            <h2>Cuestionario Inicial Anónimo</h2>
            <form id="questionnaire-form">
                <label>1. Edad: <input type="number" id="q-age" required min="18" max="99"> años</label>
                
                <label>2. Género:
                    <select id="q-gender" required>
                        <option value="">Seleccione...</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Otro">Otro / Prefiero no decir</option>
                    </select>
                </label>

                <label>3. ¿Tiene o ha tenido algún problema auditivo o antecedentes otológicos?
                    <select id="q-hearing" required><option value="">Seleccione...</option><option value="SI">SÍ</option><option value="NO">NO</option></select>
                </label>

                <label>4. En el día de hoy, ¿presenta congestión nasal, resfrío o la sensación de oídos tapados?
                    <select id="q-congestion" required><option value="">Seleccione...</option><option value="SI">SÍ</option><option value="NO">NO</option></select>
                </label>

                <label>5. Al estar en silencio, ¿suele escuchar de forma habitual un pitido, silbido o zumbido en los oídos?
                    <select id="q-tinnitus" required><option value="">Seleccione...</option><option value="SI">SÍ</option><option value="NO">NO</option></select>
                </label>

                <label>6. ¿Ha estado expuesto a música o ruidos a niveles elevados en las últimas 12 horas?
                    <select id="q-exposure" required><option value="">Seleccione...</option><option value="SI">SÍ</option><option value="NO">NO</option></select>
                </label>

                <label>7. En este momento, ¿se siente cansado/a o fatigado/a?
                    <select id="q-fatigue" required>
                        <option value="">Seleccione...</option>
                        <option value="Poco/Nada">Poco / Nada</option>
                        <option value="Moderadamente">Moderadamente</option>
                        <option value="Muy cansado">Muy cansado/a</option>
                    </select>
                </label>

                <label>8. De acuerdo con la norma ISO/TS 15666, ¿cómo calificaría su sensibilidad general al ruido?
                    <select id="q-sensitivity" required>
                        <option value="">Seleccione...</option>
                        <option value="Absolutamente nada">Absolutamente nada sensible</option>
                        <option value="Ligeramente">Ligeramente sensible</option>
                        <option value="Medianamente">Medianamente sensible</option>
                        <option value="Muy">Muy sensible</option>
                        <option value="Extremadamente">Extremadamente sensible</option>
                    </select>
                </label>
                <button type="submit">Continuar a las Instrucciones</button>
            </form>
        </section>

        <!-- ETAPA 3: Instrucciones y Prueba -->
        <section id="stage-3" class="stage">
            <h2>Instrucciones</h2>
            <p>Se reproducirán 2 sonidos (Estímulo A y Estímulo B) con una duración de 2.0 segundos cada uno, separados por un silencio de 1.0 segundo[cite: 15].</p>
            <p>Su tarea es elegir cuál de los dos sonidos le resulta <strong>MÁS MOLESTO</strong>[cite: 15].</p>
            <div class="audio-test-box">
                <p>Ajuste el volumen de sus auriculares a un nivel cómodo usando este audio de prueba:</p>
                <button id="btn-test-audio">🔊 Reproducir Audio de Prueba</button>
            </div>
            <button id="btn-start-test">Iniciar Prueba 2AFC</button>
        </section>

        <!-- ETAPA 4: Test 2AFC -->
        <section id="stage-4" class="stage">
            <h2>Prueba de Comparación <span id="trial-counter">1 de 15</span></h2>
            <div class="playback-controls">
                <button id="btn-play-pair">▶ Reproducir Comparación</button>
            </div>
            <div class="status-indicator" id="status-indicator">Presione reproducir para escuchar los estímulos.</div>
            <div class="choices">
                <button id="btn-choice-a" class="choice-btn" disabled>El Estímulo A fue más molesto</button>
                <button id="btn-choice-b" class="choice-btn" disabled>El Estímulo B fue más molesto</button>
            </div>
        </section>

        <!-- ETAPA 5: Finalización -->
        <section id="stage-5" class="stage">
            <h2>¡Prueba Finalizada!</h2>
            <p>Muchas gracias por su participación. Sus respuestas han sido registradas de forma completamente anónima.</p>
            <button id="btn-export">Enviar y Descargar Resultados</button>
            <p id="export-status"></p>
        </section>
    </div>
    <script src="script.js"></script>
</body>
</html>
