# 🚀 Web Lead Scraper

> **Painel Web de Prospecção B2B Autônomo** — Um dashboard de controle premium desenvolvido com React + Express + SQLite que varre o Google Maps, analisa a presença digital de estabelecimentos comerciais, detecta vulnerabilidades de negócios e gera abordagens comerciais com IA, tudo com streaming em tempo real via Server-Sent Events (SSE).

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-Headless-40B5A4?logo=googlechrome&logoColor=white)](https://pptr.dev)

---

## 📌 Índice

1. [Visão Geral](#-visão-geral)
2. [Instalação Rápida (via GitHub)](#-instalação-rapida-via-github)
3. [Instalação via curl (one-liner)](#-instalacao-via-curl-one-liner)
4. [Pré-requisitos](#-pré-requisitos)
5. [Como Iniciar (Workspace Unificado)](#-como-iniciar-workspace-unificado)
6. [Arquitetura de Dados e Autocorreção](#-arquitetura-de-dados-e-autocorrecao)
7. [Endpoints da API Backend](#-endpoints-da-api-backend)
8. [Resolução de Problemas](#-resolucao-de-problemas)

---

## 🔍 Visão Geral

O **Web Lead Scraper** é a interface visual definitiva para o motor de prospecção. Ele consolida em um painel premium, responsivo e com suporte a interações em tempo real todo o ciclo de prospecção comercial:

| Recurso | Descrição | Implementação Visual |
|---|---|---|
| 🗺️ **Prospecção Visual** | Busca por palavra-chave e cidade com controle de limites diretamente pelo painel. | Formulário responsivo com feed de log em tempo real. |
| 🎛️ **Streaming de Progresso** | Visualização em tempo real das etapas de scraping e análise de site. | Terminal embutido com logs de eventos via SSE (`Server-Sent Events`). |
| 📊 **Indicadores (KPIs)** | Exibição de estatísticas críticas e resumo de oportunidades comerciais. | Métricas dinâmicas com cards de glassmorphism de alta fidelidade. |
| 🔬 **Auditoria de Presença** | Classificação de leads baseada em website, certificado SSL, WhatsApp e domínio personalizado. | Tabela rica com ordenação, filtros de nicho e busca instantânea. |
| 🤖 **Gerador de Pitch (IA)** | Criação automatizada de propostas personalizadas focadas nos pontos fracos identificados. | Modal imersivo com cópia rápida em um clique para WhatsApp/Email. |
| 🧹 **Autocorreção (Auto-Heal)** | Filtra leads inconsistentes e ajusta dados corrompidos automaticamente. | Mecanismos internos com gatilho de reavaliação em massa. |

---

## 📥 Instalação Rápida (via GitHub)

### Método 1 — Clone direto (Recomendado)

```bash
# 1. Clone o repositório
git clone https://github.com/jonastduarte/web-lead-scraper.git

# 2. Acesse a pasta do projeto
cd web-lead-scraper

# 3. Instale todas as dependências do Workspace (Root, Backend e Frontend)
npm install
npm run install-all

# 4. Inicie o sistema
# Em um terminal (Backend):
npm run dev-backend

# Em outro terminal (Frontend):
npm run dev-frontend
```

### Método 2 — Baixar sem git (zip)

```bash
# Baixar o zip do repositório
curl -L https://github.com/jonastduarte/web-lead-scraper/archive/refs/heads/main.zip -o web-lead-scraper.zip
unzip web-lead-scraper.zip
cd web-lead-scraper-main

# Instalar dependências completas
npm install && npm run install-all

# Iniciar
npm run dev-backend  # Terminal 1
npm run dev-frontend # Terminal 2
```

---

## ⚡ Instalação via curl (one-liner)

Você pode instalar, configurar todo o ecossistema (incluindo as bibliotecas nativas para o Puppeteer no Ubuntu/WSL) em apenas uma linha:

```bash
curl -fsSL https://raw.githubusercontent.com/jonastduarte/web-lead-scraper/main/install.sh | bash
```

> **O que o script automatiza:**
> 1. Valida se o Node.js 18+ está ativo no ambiente.
> 2. Clona o repositório completo para `~/web-lead-scraper`.
> 3. Executa `npm install` e `npm run install-all` (Frontend + Backend).
> 4. Executa o instalador de bibliotecas nativas Chromium (`apt-get install` no Ubuntu/WSL).
> 5. Fornece o guia direto para inicialização em portas locais.

---

## 📋 Pré-requisitos

| Requisito | Versão Mínima | Método de Verificação |
|---|---|---|
| **Node.js** | 18.x ou superior | `node --version` |
| **npm** | 8.x ou superior | `npm --version` |
| **SO Linux / WSL** | Ubuntu 20.04+ (Recomendado) | `lsb_release -a` |

### Dependências nativas do Headless Chromium (Para Linux e WSL)

O Puppeteer requer libs gráficas que muitas vezes estão ausentes em ambientes virtuais ou WSL. Instale-as executando:

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates fonts-liberation libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils
```

---

## 🚀 Como Iniciar (Workspace Unificado)

Para facilitar o desenvolvimento, este projeto está estruturado como um monorepo via pacotes NPM unificados. A partir do **diretório raiz**, você pode controlar o ecossistema completo:

```bash
# Instalação limpa de todas as dependências
npm run install-all

# Inicializar o servidor Backend (Roda em http://localhost:3000)
npm run dev-backend

# Inicializar o painel Frontend (Roda em http://localhost:5173)
npm run dev-frontend
```

---

## 💾 Arquitetura de Dados e Autocorreção

O sistema utiliza um banco de dados **SQLite** independente no backend (`backend/leads.db`).

### Mecanismo de Migração Transparente:
Caso você já possua dados salvos no formato legado (`leads.json`), o backend detecta a presença do arquivo na primeira inicialização, executa a migração automática para a estrutura relacional do SQLite, remove vulnerabilidades de dados anteriores e move o arquivo para `leads_backup.json` de forma segura.

### Motor de Higienização (Auto-Heal Engine):
Os dados coletados passam por um rigoroso processo de higienização de forma transparente:
- **Limpeza de categorias redundantes:** Remove caracteres numéricos e separadores de lixo obtidos do Google Maps.
- **Normalização de avaliações:** Previne inconsistências matemáticas de reviews zerados e corrige bugs de multiplicação por 10.
- **Validação de Oportunidades:** Reclassifica e remove incoerências em leads com alta reputação.

---

## 🔌 Endpoints da API Backend

O servidor Express escuta na porta `3000`. Principais rotas disponíveis:

| Rota | Método | Descrição |
|---|---|---|
| `/api/leads` | `GET` | Recupera a lista completa de leads higienizados do SQLite. |
| `/api/leads/:id` | `DELETE` | Remove permanentemente um lead do banco de dados. |
| `/api/leads/:id/pitch` | `POST` | Dispara a geração de pitch de vendas de IA para o lead. |
| `/api/leads/re-evaluate` | `POST` | Força a higienização em massa e reavaliação de conformidade. |
| `/api/scrape` | `POST` | Inicia o motor Puppeteer. Recebe `{ keyword, location, limit }`. |
| `/api/cancel` | `POST` | Interrompe imediatamente qualquer rotina de scraping ativa. |
| `/api/stream` | `GET` | Endpoint Server-Sent Events (SSE) para stream de logs e status em tempo real. |

---

## 🛠️ Resolução de Problemas

### 1. Puppeteer / Chrome crashou ao iniciar (Protocol error)
- **Causa:** Falta das dependências de Chromium no Ubuntu/WSL.
- **Solução:** Execute o comando de instalação listado na seção [Pré-requisitos](#dependências-nativas-do-headless-chromium-para-linux-e-wsl) ou execute o instalador autônomo `install.sh`.

### 2. Porta 3000 ou 5173 já estão em uso
- **Solução:** Libere as portas executando `kill -9 $(lsof -t -i:3000)` e `kill -9 $(lsof -t -i:5173)` no terminal Linux.

### 3. A pasta node_modules está ausente no build
- **Solução:** Garanta que rodou o comando `npm run install-all` a partir do diretório raiz do projeto.

---

Desenvolvido com carinho e focado na máxima eficiência de vendas. 🚀
