# Solução de problemas

## O comando `npm` não existe

Instale Node.js 22 ou 24 e abra um terminal novo. Confirme com `node --version` e `npm --version`.

## O FFmpeg não existe

Instale-o pelo guia da sua plataforma e reabra o terminal. Confirme com `ffmpeg -version`.

## O QR não cabe na tela

Maximize a janela, reduza a fonte ou escolha o código de pareamento. No Android com WhatsApp e Termux no mesmo aparelho, o código costuma ser mais prático.

## A instalação pede chave SSH do GitHub

Atualize o repositório e repita o instalador da sua plataforma. O instalador do Termux converte dependências públicas do GitHub para transporte HTTPS durante a instalação.

## O Android encerra o SHOGUN

Execute `termux-wake-lock`, retire o Termux da otimização de bateria e mantenha a notificação da sessão ativa.

## Uma pasta com espaço dá erro

Atualize para a versão mais recente. Os processos de mídia são executados com argumentos separados. Ainda assim, prefira um caminho curto, como `C:\shogun` ou `$HOME/shogun`, para facilitar suporte.

## A sessão desconectou

Não apague arquivos isolados da pasta de sessão. Faça backup privado da pasta, pare o processo e, somente se quiser parear do zero, remova a sessão inteira conscientemente.

## Nada resolveu

Execute `npm run preflight`, copie apenas as linhas de diagnóstico sem números, chaves ou sessão e procure o [grupo oficial](https://chat.whatsapp.com/Ju0zjLiBLe28eNGUu2gapY).
