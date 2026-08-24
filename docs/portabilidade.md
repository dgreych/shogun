# Portabilidade do SHOGUN

O repositório público é tratado como uma distribuição instalável, não como uma fotografia ornamental do código.

| Plataforma | Entrada recomendada | Validação automatizada |
| --- | --- | --- |
| Android / Termux | `bash scripts/install-termux.sh` | contrato Termux + Node 20.19 |
| Windows 10/11 | `scripts/install-windows.ps1` | Windows + Node 20.19/22/24 |
| Linux | `bash scripts/install-linux.sh` | Ubuntu + Node 20.19/22/24 |
| macOS | `bash scripts/install-macos.sh` | macOS + Node 20.19/22/24 |

## O que “suportado” significa

A matriz verifica instalação de dependências, entradas principais do runtime, build modular e requisitos de plataforma. O job de qualidade executa também os testes de domínio, roteamento, estado, compatibilidade, regressões e validação de release.

No Android, o GitHub Actions não finge ser um aparelho físico. O contrato automatizado valida o caminho específico do Termux, enquanto o guia documenta as etapas que dependem do dispositivo e do pareamento real com o WhatsApp.

## Guias

- [Termux](instalacao/termux.md)
- [Windows](instalacao/windows.md)
- [Linux](instalacao/linux.md)
- [macOS](instalacao/macos.md)

Para a primeira conexão e os cuidados com a sessão, veja também [Primeiros passos](primeiros-passos.md) e [Segurança](seguranca.md).
