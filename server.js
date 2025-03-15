const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai"); // Importa OpenAI
const fs = require("fs"); // Requiere el módulo fs para leer y escribir en el archivo

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de OpenAI
const openai = new OpenAI({
    apiKey: "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", // Reemplaza con tu propia API Key
    baseURL: "https://api.openai.com/v1",
});

// Cargar datos desde el archivo data.json
function cargarDatos() {
    try {
        const data = fs.readFileSync("./data.json", "utf8");
        return JSON.parse(data);
    } catch (err) {
        console.error("Error al cargar datos:", err);
        return {};
    }
}

// Guardar datos en el archivo data.json
function guardarDatos(datos) {
    try {
        fs.writeFileSync("./data.json", JSON.stringify(datos, null, 2), "utf8");
    } catch (err) {
        console.error("Error al guardar datos:", err);
    }
}

// Cargar temas irrelevantes desde el archivo temasIrrelevantes.json
function cargarTemasIrrelevantes() {
    try {
        const data = fs.readFileSync("./temasIrrelevantes.json", "utf8");
        return JSON.parse(data).temasIrrelevantes;
    } catch (err) {
        console.error("Error al cargar los temas irrelevantes:", err);
        return [];
    }
}

// Lista de temas irrelevantes cargados desde el archivo
const temasIrrelevantes = cargarTemasIrrelevantes();

// Función para verificar si la pregunta es irrelevante
function esPreguntaIrrelevante(pregunta) {
    const normalizada = pregunta.toLowerCase();
    return temasIrrelevantes.some(tema => normalizada.includes(tema)); // Mejoramos la detección si hay un tema relevante
}

// Normaliza el texto eliminando tildes y caracteres especiales
function normalizarTexto(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar tildes
        .replace(/[^a-z\s]/g, "") // Quitar signos de puntuación
        .trim();
}

// Buscar coincidencia por palabras clave
function buscarPorPalabrasClave(pregunta, datos) {
    const normalizada = normalizarTexto(pregunta); // Normalizamos la pregunta
    for (const [preguntaBase, datosPregunta] of Object.entries(datos)) {
        // Aseguramos que la propiedad 'palabrasClave' exista antes de intentar acceder a ella
        if (datosPregunta.palabrasClave && datosPregunta.palabrasClave.some(keyword => normalizada.includes(keyword))) {
            return datosPregunta.respuesta; // Retorna la respuesta si se encuentra una coincidencia
        }
    }
    return null; // Si no se encuentra ninguna coincidencia, retorna null
}

// Generar respuesta con IA si no hay coincidencias usando OpenAI
async function generarRespuestaIA(pregunta) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4", // Usamos el modelo GPT-4
            messages: [
                {
                    role: "system",
                    content: "Eres una asesora comercial de alquiler de montacargas. Responde en máximo 5 palabras de manera más directa a la pregunta. No menciones que eres un programa informático; cuando te pregunten por los montacargas disponibles, responde amablemente que en este momento no puedes brindar la información exacta, pero pueden revisar el catálogo. Horario de atención es de 8am a 7pm. si preguntan por la oficina o dirección estamos ubicados en Barranquilla"
                },
                { role: "user", content: pregunta }
            ],
            temperature: 0.1,
            max_tokens: 10 // Ajusta este valor según lo que necesites
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error("Error en OpenAI:", error);
        return "Lo siento, no tengo información sobre eso en este momento.";
    }
}

// Función para agregar una nueva pregunta con respuesta y palabras clave
async function procesarPregunta(pregunta) {
    let datos = cargarDatos(); // Cargar los datos actuales

    // Si la pregunta es irrelevante
    if (esPreguntaIrrelevante(pregunta)) {
        // Verificar si ya se ha dado la advertencia
        if (!datos["advertencia"]) {
            // Guardar la advertencia en los datos
            datos["advertencia"] = true;
            guardarDatos(datos);
            console.log("Advertencia: No puedo responder sobre ese tema, si vuelve a preguntar solo guardaré silencio.");
            return { respuesta: "Por favor, haga preguntas relacionadas al servicio." }; // No consumirá tokens
        } else {
            // Si ya se dio la advertencia, solo devolver silencio
            console.log("Silencio: Pregunta irrelevante detectada, no se consumirá token.");
            return { respuesta: "Por favor, haga preguntas relacionadas al servicio." }; // En vez de vacío, mostramos este mensaje
        }
    }

    // Buscar respuesta en la base de datos local por palabras clave
    let respuesta = buscarPorPalabrasClave(pregunta, datos);

    // Si la respuesta no existe, usar IA (OpenAI) y almacenar la respuesta y palabras clave
    if (!respuesta) {
        console.log("Respuesta generada desde OpenAI.");
        respuesta = await generarRespuestaIA(pregunta);

        // Generar palabras clave dinámicamente
        const palabrasClave = obtenerPalabrasClave(pregunta);

        // Limitar las palabras clave a un máximo de 10
        const palabrasClaveLimitadas = palabrasClave.slice(0, 10);

        // Asegurar que las palabras clave estén siempre definidas (incluso si es la primera vez que agregamos una pregunta)
        if (!datos[pregunta]) {
            datos[pregunta] = {
                respuesta,
                palabrasClave: palabrasClaveLimitadas,
            };
        } else {
            // Si ya existe la pregunta, aseguramos que las palabras clave estén correctamente definidas
            datos[pregunta].palabrasClave = palabrasClaveLimitadas;
        }

        // Guardar los datos actualizados
        guardarDatos(datos);
    } else {
        console.log("Respuesta obtenida desde el archivo data.json.");
    }

    return { respuesta };
}

// Función para obtener las palabras clave de una pregunta (se puede personalizar)
function obtenerPalabrasClave(pregunta) {
    // Aquí generamos palabras clave dinámicamente según la pregunta
    const palabras = [];
    if (pregunta.toLowerCase().includes("horario")) {
        palabras.push("horario", "atención", "tiempo", "trabajo");
    }
    if (pregunta.toLowerCase().includes("dirección")) {
        palabras.push("dirección", "ubicación", "lugar", "donde");
    }
    if (pregunta.toLowerCase().includes("montacargas")) {
        palabras.push("montacargas", "alquiler", "disponible", "costo");
    }
    return palabras;
}

// Ruta para procesar preguntas
app.post("/preguntar", async (req, res) => {
    const pregunta = req.body.pregunta;
    console.log("Pregunta recibida:", pregunta);

    // Llamar a la función para procesar la pregunta
    const respuesta = await procesarPregunta(pregunta);

    res.json({ respuesta: respuesta.respuesta });
});

// Ruta para verificar que el servidor esté activo
app.get("/", (req, res) => {
    res.send("Servidor activo. Usa /preguntar para enviar consultas.");
});

// Iniciar el servidor
app.listen(3000, () => {
    console.log("Servidor corriendo en http://localhost:3000");
});
