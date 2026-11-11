const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const source = readFileSync(require('node:path').join(__dirname, '../script.js'), 'utf8');

/**
 * Load the app with isolated DOM, speech, and translation fixtures.
 * @param {string} userAgent Platform string exposed by the browser fixture.
 * @param {Error} [startError] Optional synchronous recognition startup failure.
 * @returns {object} Observable messages, requests, sessions, and controls.
 */
function createApp(userAgent, startError) {
    const messages = [];
    const requests = [];
    const sessions = [];
    const buttons = { 'start-english': {}, 'start-spanish': {} };
    const status = { textContent: 'Tap a language button to start listening.' };
    const mode = { checked: false };
    const elements = { ...buttons, 'recognition-status': status, 'single-utterance': mode };
    const chat = { appendChild: (message) => messages.push(message) };
    class Recognition {
        constructor() { sessions.push(this); }
        /** Simulate the optional synchronous startup failure. */
        start() { if (startError) throw startError; }
        abort() { this.onend(); }
    }
    vm.runInNewContext(source, {
        navigator: { userAgent },
        window: { SpeechRecognition: Recognition },
        document: {
            getElementById: (id) => id === 'chat-window' ? chat : elements[id],
            createElement: () => ({ classList: { add() {} } }),
        },
        URLSearchParams,
        fetch: async (url) => {
            requests.push(new URL(url));
            return { ok: true, json: async () => ({
                responseStatus: 200, responseData: { translatedText: 'translated' },
            }) };
        },
    });
    return { messages, requests, sessions, buttons, status, mode };
}

/**
 * Build a speech result, including valid finals with zero confidence.
 * @param {string} transcript Recognized phrase.
 * @param {boolean} isFinal Whether the provider marks the result final.
 * @param {number} [confidence=0] Provider confidence value.
 * @returns {Array} Speech alternative array with the result finality flag.
 */
function result(transcript, isFinal, confidence = 0) {
    return Object.assign([{ transcript, confidence }], { isFinal });
}

for (const [platform, userAgent, continuous] of [
    ['Android', 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile', false],
    ['desktop', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0', true],
    ['iOS', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', true],
]) {
    test(`${platform} recognition mode and zero-confidence final translation`, async () => {
        const app = createApp(userAgent);
        app.buttons['start-english'].onclick();
        const recognition = app.sessions[0];
        assert.equal(recognition.continuous, continuous);
        assert.equal(recognition.interimResults, continuous);
        recognition.onresult({ resultIndex: 0, results: [result('hello', false)] });
        assert.equal(app.messages.length, 0);
        recognition.onresult({ resultIndex: 0, results: [result('hello world', true)] });
        await new Promise(setImmediate);
        assert.deepEqual(app.messages.map((message) => message.textContent), [
            'hello world', 'Translation: translated',
        ]);
        assert.equal(app.requests.length, 1);
        assert.equal(app.requests[0].searchParams.get('q'), 'hello world');
        assert.equal(app.requests[0].searchParams.get('langpair'), 'en|es');
    });
}

test('Android next utterance and language replacement discard stale results', () => {
    const app = createApp('Android');
    app.buttons['start-english'].onclick();
    const first = app.sessions[0];
    first.onend();
    first.onresult({ resultIndex: 0, results: [result('stale', true)] });
    app.buttons['start-english'].onclick();
    const second = app.sessions[1];
    app.buttons['start-spanish'].onclick();
    second.onresult({ resultIndex: 0, results: [result('stale', true)] });
    app.sessions[2].onresult({ resultIndex: 0, results: [result('hola', true)] });
    assert.equal(app.requests.length, 1);
    assert.equal(app.requests[0].searchParams.get('langpair'), 'es|en');
    assert.equal(app.messages[0].textContent, 'hola');
});

test('desktop continues processing distinct final result indices', () => {
    const app = createApp('Windows');
    app.buttons['start-english'].onclick();
    const recognition = app.sessions[0];
    const results = [result('hello', true), result('hello again', true)];
    recognition.onresult({ resultIndex: 0, results: results.slice(0, 1) });
    recognition.onresult({ resultIndex: 1, results });
    assert.deepEqual(app.requests.map((url) => url.searchParams.get('q')), ['hello', 'hello again']);
});

test('desktop identity can opt into single utterances without changing defaults', () => {
    const app = createApp('Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0');
    app.buttons['start-english'].onclick();
    assert.equal(app.sessions[0].continuous, true);
    app.mode.checked = true;
    app.buttons['start-spanish'].onclick();
    assert.equal(app.sessions[1].continuous, false);
    assert.equal(app.sessions[1].interimResults, false);
    app.mode.checked = false;
    app.buttons['start-english'].onclick();
    assert.equal(app.sessions[2].continuous, true);
});

test('status follows actual start and end, ignoring replaced session callbacks', () => {
    const app = createApp('Android');
    app.buttons['start-english'].onclick();
    const first = app.sessions[0];
    assert.equal(app.status.textContent, 'Starting microphone…');
    first.onstart();
    assert.equal(app.status.textContent, 'Listening for one phrase…');
    first.onend();
    assert.match(app.status.textContent, /Listening ended.*Tap a language button/);
    app.buttons['start-spanish'].onclick();
    const starting = app.status.textContent;
    first.onstart();
    first.onerror({ error: 'aborted' });
    first.onend();
    assert.equal(app.status.textContent, starting);
    assert.equal(app.messages.length, 0);
    app.sessions[1].onstart();
    assert.equal(app.status.textContent, 'Listening for one phrase…');
});

test('recognition error remains visible after session ends', () => {
    const app = createApp('Android');
    app.buttons['start-english'].onclick();
    app.sessions[0].onstart();
    app.sessions[0].onerror({ error: 'not-allowed' });
    const failed = app.status.textContent;
    app.sessions[0].onend();
    assert.equal(app.status.textContent, failed);
    assert.match(failed, /Listening stopped/);
    assert.equal(app.messages[0].textContent, 'Speech recognition failed: not-allowed.');
});

test('startup failure clears pending status and retains the error message', () => {
    const app = createApp('Android', new Error('microphone unavailable'));
    app.buttons['start-english'].onclick();
    assert.match(app.status.textContent, /Listening could not start/);
    assert.equal(app.messages[0].textContent, 'Speech recognition failed: microphone unavailable.');
    app.sessions[0].onstart();
    assert.match(app.status.textContent, /Listening could not start/);
});

test('continuous recognition also reports listening and normal completion', () => {
    const app = createApp('Windows');
    app.buttons['start-english'].onclick();
    app.sessions[0].onstart();
    assert.equal(app.status.textContent, 'Listening…');
    app.sessions[0].onend();
    assert.match(app.status.textContent, /Tap a language button/);
});

test('page supplies an accessible status and labelled single-utterance control', () => {
    const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
    assert.match(html, /<p id="recognition-status" role="status">/);
    assert.match(html, /<label><input id="single-utterance" type="checkbox"> Use one phrase per tap/);
});
