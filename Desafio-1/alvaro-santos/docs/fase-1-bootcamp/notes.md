# Notas de Arquitetura, Decisões & Contexto do Projeto (notes.md)
## Projeto: Chatbot com Tools MCP de Pagamentos

> **Objetivo deste documento:** Registrar as decisões arquiteturais, o alinhamento técnico com o instrutor, as nuances do [`desafio.md`](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/docs/fase-1-bootcamp/desafio.md) e o contexto de transição entre HTTP Streaming e WebSockets. Este arquivo serve como fonte de verdade rápida para continuidade entre sessões de chat e alinhamento com a dupla.

---

## 1. Contexto das Decisões do Backend (Dia 2 — 28/08)

### 1.1 Alinhamento Oficial com o Instrutor (Pedro Leale)
> **Dúvida do Aluno:** "Queria confirmar uma dúvida sobre o desafio... inicialmente tinha tomado pra mim que era requisito WebSocket e persistência. É considerado extra ou não é necessário?"  
> **Resposta Oficial do Instrutor (Pedro Leale - 28/08 às 12h08):**  
> *"Implementar a comunicação em streaming http, não precisa ser websocket. Sobre persistência, o chat precisa viver apenas em memória de execução. Para implementar persistência dos dados localmente precisaria de um docker com banco de dados e não entra no escopo dessa fase do programa de bolsas."*

### 1.2 Diretrizes Consolidadas
- **Protocolo de Chat:** HTTP Streaming (`ReadableStream` / `application/x-ndjson`) via `POST /api/chat`.
- **Persistência de Dados:** 100% em memória de execução (`Map` / JavaScript runtime).
- **Autenticação:** JWT com expiração de 1h (`expiresIn: "1h"`) e senhas com hash `scrypt`.
- **Modelo LLM Local:** `qwen3:1.7b` via Ollama local na porta `11434`.

---

## 2. Estratégia de Desacoplamento de Transporte (Dual-Transport Ready)

Para garantir que o Backend possa operar via **HTTP Streaming (NDJSON)** e, caso necessário na integração de sábado (29/08), alternar para **WebSocket (`ws`)** em poucos minutos sem refatoração:

```
                      ┌───────────────────────────────────────────────┐
                      │          agentService.ts (Lógica Pura)        │
                      │  - Loop com Ollama (Ollama Client)            │
                      │  - MCP Client (conecta em :3001/mcp)          │
                      │  - Gestão do Histórico Completo da Conversa   │
                      └───────────────────────┬───────────────────────┘
                                              │ Callbacks de Eventos
                        ┌─────────────────────┴─────────────────────┐
                        ▼                                           ▼
          ┌───────────────────────────┐               ┌───────────────────────────┐
          │     Canal HTTP Stream     │               │      Canal WebSocket      │
          │   POST /api/chat (Fetch)  │               │      ws://localhost:3000  │
          │   (Template do Instrutor) │               │      (Opcional no Sábado) │
          └───────────────────────────┘               └───────────────────────────┘
```

### 2.1 Por que o Frontend da Pessoa B NÃO é impactado?
- **Componentes Visuais:** Tela de login, seleção de perfis (`cliente_vip`, `cliente_padrao`, `cliente_sem_saldo`), balões de mensagem, badges de tool call e cards de comprovante de compra são **100% idênticos** nos dois modelos.
- **Camada de Transporte:** No frontend, apenas a função isolada `sendMessage()` consome o stream via `fetch()` em vez de abrir um socket persistente, reduzindo complexidade no React.

---

## 3. Topologia e Portas dos Serviços

| Serviço | Diretório | Porta | Protocolo / Transporte | Status |
|---|---|---|---|---|
| **MCP Server** | `mcp-tools/` | `3001` | Streamable HTTP Stateless (`POST /mcp`) | **Concluído & Merged na Main** |
| **Backend API** | `backend/` | `3000` | HTTP REST (`/api/auth`) + HTTP Stream (`/api/chat`) | **Em Desenvolvimento (Dia 2)** |
| **LLM Local** | — | `11434`| Ollama API (`qwen3:1.7b`) | Local |
| **Frontend** | `frontend/` | `5173` | React + Vite (Kauan Pedreira) | Em Desenvolvimento |

---

## 4. O que o Backend precisa implementar no Dia 2 (28/08)

1. **`backend/src/auth/`**:
   - Rotas `POST /api/auth/login` e `GET /api/user/me`.
   - Perfis de teste: `cliente_vip` (15k), `cliente_padrao` (2k), `cliente_sem_saldo` (100).
   - Middleware de autenticação JWT/Bearer para proteger a rota de chat.
2. **`backend/src/mcp/client.ts`**:
   - Conexão com `http://localhost:3001/mcp` via `StreamableHTTPClientTransport`.
   - `listTools()` e conversão para schemas do Ollama (`toOllamaTools()`).
   - `runTool()` para executar tools no MCP Server.
3. **`backend/src/llm/`**:
   - System Prompt com persona de assistente de vendas em português.
   - `agentService.ts` com o loop de execução e streaming de tokens.
4. **`backend/src/server.ts`**:
   - Servidor Express expondo as rotas na porta `3000`.

---

## 5. Decisão de Arquitetura: Separação de Domínios de Usuários (Backend vs. MCP Server)

### 5.1 Contexto
Durante o desenvolvimento do Dia 2, surgiu a questão sobre a existência de estruturas de dados de usuários tanto em `backend/src/auth/users.ts` quanto em `mcp-tools/src/db/users.ts`.

### 5.2 Decisão e Justificativa (Bounded Contexts)
A separação é intencional e reflete o padrão de microserviços desacoplados com execução 100% em memória:
- **`backend/` (Domínio de Autenticação):** Responsável por autenticar credenciais no login (`POST /api/auth/login`), armazenar o hash seguro da senha com `scrypt` e emitir tokens JWT.
- **`mcp-tools/` (Domínio Financeiro e Transacional):** Responsável por manter o saldo de crédito atualizado, validar o limite disponível durante a execução da ferramenta `realizar_compra` e efetuar baixas atômicas.
- **Consistência Sem Docker/Banco Central:** Ambos os serviços rodam em processos isolados do Node.js e compartilham os mesmos identificadores de usuário (`usr_vip_01`, `usr_std_02`, `usr_low_03`) e limites iniciais de crédito, garantindo que o usuário autenticado no backend seja debitado no serviço financeiro com precisão.
