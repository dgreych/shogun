# Instalar o SHOGUN no Termux

Use um Android reserva quando possível. O sistema pode encerrar aplicativos em segundo plano para economizar bateria.

## 1. Instalar o Termux certo

Use a versão do F-Droid ou do GitHub oficial. A versão antiga da Play Store não é adequada.

## 2. Abrir o quartel

No Termux:

```bash
pkg update -y
pkg install -y git
git clone https://github.com/dgreych/shogun.git
cd shogun
bash scripts/install-termux.sh
```

O instalador prepara Node.js, FFmpeg, as dependências e a configuração local.

## 3. Evitar que o Android durma no posto

Instale também o aplicativo Termux:API se quiser usar o bloqueio de suspensão. Depois:

```bash
pkg install -y termux-api
termux-wake-lock
```

Nas configurações do Android, retire o Termux da otimização de bateria.

## 4. Conectar o WhatsApp

```bash
npm start
```

Se o WhatsApp está no mesmo celular, escolha **código de pareamento**. Anote o código exibido, abra **Aparelhos conectados → Conectar com número de telefone** e digite-o.

## 5. Voltar outro dia

```bash
cd shogun
termux-wake-lock
npm start
```

Para encerrar, pressione `Ctrl+C` e depois use `termux-wake-unlock`.

## Inicializar depois de reiniciar o celular

O SHOGUN não altera seu `.bashrc`. Essa proteção evita loops e terminais presos.

Se quiser inicialização automática, instale o aplicativo Termux:Boot e crie manualmente `~/.termux/boot/start-shogun`:

```bash
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
cd "$HOME/shogun"
npm start >> "$HOME/shogun/termux-boot.log" 2>&1
```

Depois torne o arquivo executável:

```bash
chmod 700 ~/.termux/boot/start-shogun
```

Faça primeiro uma execução manual completa e confirme `!menu` antes de ativar o boot.
