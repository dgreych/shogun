# Cliente BunnyFy do Gyomei

Este módulo concentra autenticação, timeout, limite de resposta, idempotência,
erros e validação do contrato BunnyFy. Consumidores não devem montar URLs,
cabeçalhos ou interpretar envelopes diretamente.

Exemplo de construção, sem valores reais:

```js
import { BunnyFyClient } from './services/bunnyfy/index.js';

const bunnyfy = new BunnyFyClient({
  baseUrl: process.env.BUNNYFY_BASE_URL,
  token: process.env.BUNNYFY_API_TOKEN
});
```

Interfaces iniciais:

```text
uploadMedia(buffer, { filename, mime, idempotencyKey? })
uploadImage(buffer, { filename, mime, idempotencyKey? })
downloadYouTubeAudio({ url } | { query }, { quality? })
downloadYouTubeAudioByQuery(query, { quality? })
downloadYouTubeVideo({ url } | { query }, { quality? })
downloadYouTubeVideoByQuery(query, { quality? })
downloadMedia(media, { maxBytes?, timeoutMs? })
createWelcomeCard(payload, { idempotencyKey? })
createProfileCard(payload, { idempotencyKey? })
createCompatibilityCard(payload, { idempotencyKey? })
createRankingCard(payload, { idempotencyKey? })
createAchievementCard(payload, { idempotencyKey? })
upscaleImage(mediaId, scale, { idempotencyKey? })
getMovieQuiz({ difficulty? })
createChatCompletion(messages, { temperature?, maxOutputTokens?, model? })
```

Os métodos visuais recebem somente o objeto de dados documentado pela BunnyFy.
Avatares entram por `avatarMediaId`, depois de `uploadMedia`; o cliente resolve a
`mediaUrl` relativa somente contra a mesma origem configurada.

YouTube aceita exatamente uma URL ou uma busca textual. Esses POSTs fazem uma
única tentativa e não enviam `Idempotency-Key` enquanto a rota não tiver
deduplicação. `downloadMedia` aceita apenas a origem BunnyFy e o caminho de mídia,
envia Bearer, bloqueia redirects e interrompe a leitura no teto configurado,
cujo padrão no consumidor é 50 MiB. `play` e `ytmp3` mantêm um slot local desde
o início do download até o fim do envio; o padrão é um e o teto configurável é
quatro. Thumbnails são reduzidas a uma allowlist HTTPS dos hosts públicos do
YouTube antes de chegarem ao transporte do WhatsApp.

A conversa aceita somente um modelo do catálogo do bot, e a BunnyFy repete a
validação contra sua allowlist privada. Ela é a exceção temporária à
idempotência: faz um único POST,
sem `Idempotency-Key` e sem retry automático, até a rota ter deduplicação
própria. O cliente não envia modelo, endpoint, headers nem nome do provedor.

No V20, áudio/vídeo do YouTube, upscale, os cinco modelos Canvas e quiz de
cinema possuem consumidores isolados por flags e passaram em smoke real. A
assistente continua isolada pelo mesmo gateway, mas permanece desligada em
produção até a remediação da credencial histórica.
