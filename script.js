const chatWindow = document.getElementById('chat-window');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const MAX_TRANSLATION_CHARS = 500;

function appendMessage(className, text) {
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.textContent = text;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

function splitForTranslation(text) {
    const words = text.match(/\S+/g) || [];
    const chunks = [];
    let chunk = '';

    for (const word of words) {
        if (word.length > MAX_TRANSLATION_CHARS) {
            throw new Error('A word is too long to send to the translation service.');
        }
        const candidate = chunk ? `${chunk} ${word}` : word;
        if (candidate.length > MAX_TRANSLATION_CHARS) {
            chunks.push(chunk);
            chunk = word;
        } else {
            chunk = candidate;
        }
    }

    if (chunk) chunks.push(chunk);
    return chunks;
}

async function translateChunk(text, source, target) {
    const query = new URLSearchParams({ q: text, langpair: `${source}|${target}` });
    const response = await fetch(`https://api.mymemory.translated.net/get?${query}`);
    if (!response.ok) {
        throw new Error(`Translation service returned ${response.status}.`);
    }

    const result = await response.json();
    const translation = result.responseData?.translatedText;
    if (Number(result.responseStatus) !== 200 || typeof translation !== 'string' || !translation.trim()) {
        throw new Error(result.responseDetails || 'The translation service returned no translation.');
    }
    return translation;
}

async function translateText(text, source, target) {
    const chunks = splitForTranslation(text);
    const translatedChunks = await Promise.all(
        chunks.map((chunk) => translateChunk(chunk, source, target))
    );
    return translatedChunks.join(' ');
}

function startRecognition(langCode, className) {
    if (!SpeechRecognition) {
        appendMessage('translation error', 'Speech recognition is not supported in this browser.');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langCode;

    recognition.onerror = (event) => {
        appendMessage('translation error', `Speech recognition failed: ${event.error}.`);
    };

    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (!event.results[i].isFinal) continue;

            const transcript = event.results[i][0].transcript.trim();
            if (!transcript) continue;

            appendMessage(className, transcript);
            const translation = appendMessage('translation', 'Translating…');
            const source = className === 'english' ? 'en' : 'es';
            const target = className === 'english' ? 'es' : 'en';

            translateText(transcript, source, target)
                .then((translated) => {
                    translation.textContent = `Translation: ${translated}`;
                })
                .catch((error) => {
                    translation.classList.add('error');
                    translation.textContent = `Translation unavailable: ${error.message}`;
                });
        }
    };

    recognition.start();
}

document.getElementById('start-english').onclick = () => startRecognition('en-US', 'english');
document.getElementById('start-spanish').onclick = () => startRecognition('es-CO', 'spanish');
