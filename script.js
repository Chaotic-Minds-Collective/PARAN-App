const chatWindow = document.getElementById('chat-window');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const MAX_TRANSLATION_CHARS = 500;
let activeRecognition = null;

/**
 * Append a plain-text conversation message and return its DOM element.
 * @param {string} className CSS classes identifying the message type.
 * @param {string} text Message content.
 * @returns {HTMLDivElement} The appended message.
 */
function appendMessage(className, text) {
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.textContent = text;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}

/**
 * Split text at whitespace into chunks within the translation service limit.
 * @param {string} text Transcript to split.
 * @returns {string[]} Nonempty chunks of at most MAX_TRANSLATION_CHARS characters.
 * @throws {Error} If a single word exceeds the service limit.
 */
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

/**
 * Request one translation chunk and reject unsuccessful or empty responses.
 * @param {string} text Text within the translation service character limit.
 * @param {string} source Source language code.
 * @param {string} target Target language code.
 * @returns {Promise<string>} Translated text.
 * @throws {Error} If the request fails or the service returns an invalid result.
 */
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

/**
 * Translate a transcript in parallel chunks, preserving their original order.
 * @param {string} text Transcript to translate.
 * @param {string} source Source language code.
 * @param {string} target Target language code.
 * @returns {Promise<string>} Joined translations; rejects if any chunk fails.
 */
async function translateText(text, source, target) {
    const chunks = splitForTranslation(text);
    const translatedChunks = await Promise.all(
        chunks.map((chunk) => translateChunk(chunk, source, target))
    );
    return translatedChunks.join(' ');
}

/**
 * Replace the active speech session and translate each finalized transcript.
 * @param {string} langCode Browser speech recognition locale.
 * @param {string} className Conversation speaker class (english or spanish).
 * @returns {void}
 */
function startRecognition(langCode, className) {
    if (!SpeechRecognition) {
        appendMessage('translation error', 'Speech recognition is not supported in this browser.');
        return;
    }

    if (activeRecognition) {
        const previousRecognition = activeRecognition;
        activeRecognition = null;
        previousRecognition.abort();
    }

    const recognition = new SpeechRecognition();
    activeRecognition = recognition;
    // Android continuous recognition can report partial phrases as final results.
    // Request a single utterance without partial updates on that platform.
    const isAndroid = /Android/i.test(navigator.userAgent);
    recognition.continuous = !isAndroid;
    recognition.interimResults = !isAndroid;
    recognition.lang = langCode;

    recognition.onend = () => {
        if (activeRecognition === recognition) activeRecognition = null;
    };

    recognition.onerror = (event) => {
        if (activeRecognition !== recognition) return;
        appendMessage('translation error', `Speech recognition failed: ${event.error}.`);
    };

    recognition.onresult = (event) => {
        if (activeRecognition !== recognition) return;
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

    try {
        recognition.start();
    } catch (error) {
        if (activeRecognition === recognition) activeRecognition = null;
        appendMessage('translation error', `Speech recognition failed: ${error.message}.`);
    }
}

document.getElementById('start-english').onclick = () => startRecognition('en-US', 'english');
document.getElementById('start-spanish').onclick = () => startRecognition('es-CO', 'spanish');
