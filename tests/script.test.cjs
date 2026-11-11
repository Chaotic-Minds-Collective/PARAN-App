const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const source = readFileSync(require('node:path').join(__dirname, '../script.js'), 'utf8');

function createApp(userAgent) {
    const messages = [];
    const requests = [];
    const sessions = [];
    const buttons = { 'start-english': {}, 'start-spanish': {} };
    const chat = { appendChild: (message) => messages.push(message) };
    class Recognition {
        constructor() { sessions.push(this); }
        start() {}
        abort() { this.onend(); }
    }
    vm.runInNewContext(source, {
        navigator: { userAgent },
        window: { SpeechRecognition: Recognition },
        document: {
            getElementById: (id) => id === 'chat-window' ? chat : buttons[id],
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
    return { messages, requests, sessions, buttons };
}

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
