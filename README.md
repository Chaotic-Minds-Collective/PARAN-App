# PARAN — Chaotic Minds Collective App

**PARAN** is a Chaotic Minds Collective (CMC) app for mobile-first, real-time, two-way speech translation between English and Colombian Spanish. The browser's speech recognition captures each finalized utterance, and the app translates it between English and Spanish with the MyMemory translation API.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:a2e46af9c6a7c7f9e5a80ec661ae3e78702f3b9fada91d23e9f389388aabc796 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:e58a1b3733c992b8bcbcdeb9b2fdc990cd6be9166e61901255ba922ef9faa274 -->

On Android, recognition captures one utterance per button press to avoid browsers reporting incremental phrases as final in continuous mode. Tap the language button again for the next phrase. Other platforms use continuous recognition. If your browser uses a desktop identity or repeats phrases, select “Use one phrase per tap” before tapping a language button. The listening status shows when recognition starts and ends.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

Speech recognition depends on browser support and may use a browser-provided service. Transcript text is sent to MyMemory for translation; do not use the app for sensitive conversations. The app requires an internet connection for translation. Translation failures are shown in the conversation instead of being silently treated as success.
