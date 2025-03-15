const button = document.getElementById("start-button");
const responseText = document.getElementById("response-text");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isListening = false; // 🔹 Controla si el reconocimiento está activo

if (!SpeechRecognition) {
    alert("Tu navegador no soporta reconocimiento de voz. Prueba con Google Chrome.");
} else {
    recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = true; // 🔹 Permite escucha continua
    recognition.interimResults = false; // 🔹 Solo resultados finales

    button.addEventListener("click", () => {
        if (!isListening) {
            startListening();
        }
    });

    function startListening() {
        if (!isListening) {
            recognition.start();
            isListening = true;
            responseText.textContent = "🎤 Asistente escuchando...";
            console.log("🎤 Reconocimiento de voz iniciado...");
        }
    }

    function stopListening() {
        if (isListening) {
            recognition.stop();
            isListening = false;
            console.log("⏸ Reconocimiento de voz detenido...");
        }
    }

    recognition.onresult = (event) => {
        let text = event.results[event.results.length - 1][0].transcript;
        responseText.textContent = `Tú dijiste: ${text}`;

        // 🔹 Normalizar y enviar la pregunta
        const normalizedText = normalizeText(text);
        sendToBackend(normalizedText);
    };

    recognition.onspeechend = () => {
        console.log("🎙 No se detecta más voz, esperando...");
    };

    recognition.onend = () => {
        console.log("⏹ Reconocimiento finalizado. Reiniciando en 1 segundo...");
        isListening = false;
        setTimeout(() => startListening(), 1000); // 🔹 Reinicia después de 1s
    };

    recognition.onerror = (event) => {
        console.error("⚠️ Error en el reconocimiento de voz:", event.error);
        responseText.textContent = "⚠️ Error al reconocer voz. Intentando nuevamente...";
        
        if (event.error === "no-speech") {
            console.warn("🔇 No se detectó voz, reiniciando en 2 segundos...");
            setTimeout(() => startListening(), 2000);
        } else if (event.error === "network") {
            console.error("🚨 Error de conexión, deteniendo reconocimiento.");
            stopListening();
        } else if (event.error === "not-allowed") {
            console.error("🚫 Permiso denegado para el micrófono.");
            stopListening();
        } else {
            setTimeout(() => startListening(), 3000);
        }
    };
}

// 🔹 Normalizar texto antes de enviarlo al backend
function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar tildes
        .replace(/[¿?¡!.,]/g, "") // Quitar signos de puntuación
        .trim();
}

// 🔹 Enviar la pregunta al backend
function sendToBackend(query) {
    console.log("Pregunta enviada al backend:", query);

    fetch("http://localhost:3000/preguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: query })
    })
    .then(response => response.json())
    .then(data => {
        console.log("Respuesta del backend:", data);
        responseText.textContent = `Respuesta: ${data.respuesta}`;
        speak(data.respuesta);
    })
    .catch(error => {
        console.error("Error en la solicitud:", error);
        responseText.textContent = "Error al obtener respuesta.";
    });
}

// 🔹 Función para hablar la respuesta
function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);

    // Seleccionar una voz femenina en español
    const voices = speechSynthesis.getVoices();
    let selectedVoice = voices.find(voice => voice.lang.includes("es") && voice.name.toLowerCase().includes("female"));

    if (!selectedVoice) {
        selectedVoice = voices.find(voice => voice.lang.includes("es"));
    }

    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    utterance.rate = 0.9;  // 🔹 Velocidad más pausada
    utterance.pitch = 1.1; // 🔹 Un poco más aguda
    utterance.volume = 1;   // 🔹 Máximo volumen

    speechSynthesis.speak(utterance);
}

// 🔹 Asegurar que las voces se carguen antes de usarlas
speechSynthesis.onvoiceschanged = () => {
    console.log("Voces de síntesis de voz disponibles:", speechSynthesis.getVoices());
};
