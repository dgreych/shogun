<h1 align="center">🪟 SHOGUN no Windows</h1>
<p align="center"><strong>Do PowerShell ao primeiro <code>!menu</code>, sem pular as partes que normalmente viram problema depois.</strong></p>

<p align="center">
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?logo=windows&logoColor=white">
  <img alt="Node 20.19+" src="https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white">
  <img alt="Tempo" src="https://img.shields.io/badge/primeira%20instala%C3%A7%C3%A3o-10%E2%80%9320%20min-6b2637">
</p>

## Rota completa

| Etapa | Ação | Sinal de sucesso |
| --- | --- | --- |
| **1** | abrir PowerShell | prompt disponível |
| **2** | instalar Git, Node e FFmpeg | comandos mostram versões |
| **3** | clonar o projeto | pasta `shogun` criada |
| **4** | rodar o instalador | setup concluído |
| **5** | executar preflight | requisitos obrigatórios aprovados |
| **6** | conectar WhatsApp | feed do bot ativo |
| **7** | testar | `!menu` responde |

---

## 1 · Abra o PowerShell

No menu **Iniciar**, procure por **PowerShell**. Para executar o SHOGUN normalmente não é necessário abrir como administrador.

Você pode colar os comandos com `Ctrl+V`. Execute um bloco de cada vez e espere o prompt voltar.

---

## 2 · Instale as ferramentas

Primeiro confira se o `winget` está disponível:

```powershell
winget --version
```

Se não estiver, atualize o **Instalador de Aplicativo** pela Microsoft Store e abra uma nova janela do PowerShell.

### Git

```powershell
winget install --id Git.Git -e --source winget
```

### Node.js LTS

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

### FFmpeg

```powershell
winget install --id Gyan.FFmpeg -e --source winget
```

Feche o PowerShell e abra outro depois das instalações. O Windows precisa reconstruir o `PATH`, porque descobrir imediatamente que um programa acabou de ser instalado seria aparentemente pedir demais.

### Confira

```powershell
node --version
npm --version
git --version
ffmpeg -version
```

> [!IMPORTANT]
> O SHOGUN exige **Node.js 20.19.0 ou superior**. Node 22/24 LTS é uma boa escolha para instalação nova.

---

## 3 · Baixe o projeto

```powershell
Set-Location $HOME
git clone https://github.com/dgreych/shogun.git
Set-Location shogun
```

Se a pasta já existir, não clone por cima:

```powershell
Set-Location "$HOME\shogun"
```

---

## 4 · Execute o instalador do SHOGUN

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

O instalador verifica o ambiente, instala as dependências travadas pelo projeto e abre o setup.

<table>
<tr><td><strong>Seu nome</strong></td><td>identificação local do dono</td></tr>
<tr><td><strong>Número</strong></td><td>país + DDD + número, somente dígitos</td></tr>
<tr><td><strong>Nome do bot</strong></td><td>nome desta instalação</td></tr>
<tr><td><strong>Prefixo</strong></td><td>por exemplo <code>!</code></td></tr>
</table>

Para refazer apenas essa configuração depois:

```powershell
npm run setup
```

---

## 5 · Faça a inspeção antes do boot

```powershell
npm run preflight
```

<p align="center">
  <img src="img/preflight-windows.png" alt="Preflight do SHOGUN no Windows" width="92%">
</p>

O preflight verifica Node.js, npm, Git, FFmpeg e os arquivos locais necessários para iniciar.

---

## 6 · Inicie e conecte o WhatsApp

```powershell
npm start
```

O painel oferece **QR Code** e **código de pareamento**.

<p align="center">
  <img src="img/painel.png" alt="Painel de conexão do SHOGUN" width="82%">
</p>

Para QR Code, no telefone abra **WhatsApp → Aparelhos conectados → Conectar um aparelho**.

Se preferir não usar a câmera, reinicie o fluxo e escolha o código de pareamento. Depois que a sessão for criada, ela é reaproveitada nos próximos boots enquanto continuar válida.

---

## 7 · Prove que terminou

Envie em um grupo de teste:

```text
!menu
```

Se escolheu outro prefixo, use-o no lugar de `!`.

> [!TIP]
> O PowerShell precisa permanecer aberto enquanto o processo estiver rodando. Fechar a janela encerra essa execução do bot.

---

## Uso diário

### Parar

Pressione `Ctrl+C`.

### Iniciar novamente

```powershell
Set-Location "$HOME\shogun"
npm start
```

### Atualizar

```powershell
Set-Location "$HOME\shogun"
git pull --ff-only
npm ci --no-audit --no-fund
npm run preflight
npm start
```

---

## Diagnóstico

<details>
<summary><strong>PowerShell diz que execução de scripts foi desabilitada</strong></summary>
<br>
Use o comando do instalador exatamente com <code>-ExecutionPolicy Bypass</code>. Ele aplica a exceção ao processo usado para essa instalação.
</details>

<details>
<summary><strong><code>ffmpeg</code>, <code>node</code> ou <code>git</code> não é reconhecido</strong></summary>
<br>
Feche todas as janelas do PowerShell, abra outra e teste novamente. Se persistir, reinicie o Windows uma vez e rode <code>npm run preflight</code> antes de reinstalar qualquer coisa.
</details>

<details>
<summary><strong>O QR ficou pequeno ou ilegível</strong></summary>
<br>
Maximize a janela ou use o código de pareamento.
</details>

<details>
<summary><strong>A pasta <code>shogun</code> já existe</strong></summary>
<br>
Entre nela com <code>Set-Location "$HOME\shogun"</code>. Não clone outra cópia por cima.
</details>

---

## 🔐 Proteja a sessão

A sessão vinculada fica em `dados/database/qr-code/`.

> [!CAUTION]
> Não envie essa pasta para suporte, GitHub, Drive ou outras pessoas. Ela contém material de autenticação da conta conectada.

Para diagnóstico adicional, execute `npm run preflight` e consulte **[Solução de problemas](../solucao-de-problemas.md)**.

<p align="center"><a href="../../README.md">← Voltar à página principal</a></p>