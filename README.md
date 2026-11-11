# PARAN-App

Mobile-first, real-time, two-way speech translation for English and Colombian Spanish speakers. The browser's speech recognition captures each finalized utterance, and the app translates it between English and Spanish with the MyMemory translation API.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:a2e46af9c6a7c7f9e5a80ec661ae3e78702f3b9fada91d23e9f389388aabc796 -->

On Android, recognition captures one utterance per button press to avoid browsers reporting incremental phrases as final in continuous mode. Tap the language button again for the next phrase. Other platforms use continuous recognition.

<!-- /coderabbit-ai-generated:v1 -->

Speech recognition depends on browser support and may use a browser-provided service. Transcript text is sent to MyMemory for translation; do not use the app for sensitive conversations. The app requires an internet connection for translation. Translation failures are shown in the conversation instead of being silently treated as success.
