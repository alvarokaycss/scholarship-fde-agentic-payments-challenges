# Quadro Kanban & Rastreabilidade de Tarefas (tasks.md)
## Projeto: Chatbot com Tools MCP de Pagamentos

> **Sprint:** 27/08 a 01/09 (6 Dias)  
> **Data Atual / Marco:** Fim do Dia 2 (28/08) — Backend Concluído com Sucesso  
> **Status Geral:** Dia 1 (MCP Server) e Dia 2 (Backend API & Orquestrador LLM) 100% implementados, testados e validados.  

---

## 📌 Visão Rápida do Kanban

```
┌───────────────────────────┬───────────────────────────┬───────────────────────────┬───────────────────────────┐
│        📋 BACKLOG         │       ⏳ TO DO (DIA 3)     │     🚧 IN PROGRESS        │         ✅ DONE           │
├───────────────────────────┼───────────────────────────┼───────────────────────────┼───────────────────────────┤
│ • Bateria dos 10 testes   │ • Integração Fim-a-Fim    │ • Pessoa B: Frontend base │ • Setup Monorepo & Git    │
│   (Domingo 30/08)         │   (Frontend + Backend +   │   (Login + Chat UI)       │ • 3 Tools MCP (mcp-tools) │
│ • Screenshots & README    │   MCP Server + Ollama)    │                           │ • Testes unitários MCP    │
│   (Segunda 31/08)         │ • Teste do fluxo feliz    │                           │ • Módulo de Auth (JWT 1h) │
│ • Entrega (Terça 01/09)   │   completo com o duo      │                           │ • Senhas com scrypt       │
│                           │                           │                           │ • Rotas /login e /me      │
│                           │                           │                           │ • MCP Client (client.ts)  │
│                           │                           │                           │ • Orquestrador Ollama     │
│                           │                           │                           │ • Rota POST /api/chat     │
│                           │                           │                           │ • Suíte de testes em src/ │
└───────────────────────────┴───────────────────────────┴───────────────────────────┴───────────────────────────┘
```

---

## 👨‍💻 Trilha Pessoa A — Backend & MCP Server

### ✅ Concluído (Dia 1 — 27/08: MCP Server)
- [x] **Servidor MCP (`mcp-tools` na porta 3001):**
  - Catálogo, intenções e liquidação com as 3 tools (`listar_catalogo`, `registrar_intencao`, `realizar_compra`).
  - Suíte de testes `src/test-tools.ts` aprovada com 7 cenários.
  - Documentação `README.md` com evidências do Postman.
  - Merged em `dev`, `stage` e `main`.

### ✅ Concluído (Dia 2 — 28/08: Backend API & Orquestrador)
- [x] **Infraestrutura do Backend (`backend/`):**
  - Setup de pacotes, TypeScript, `.env`, `.gitignore` e documentação `README.md`.
- [x] **Módulo de Autenticação & Usuários (`src/auth/`):**
  - Hashing de senhas com `scrypt` e comparação `timingSafeEqual` (`password.ts`).
  - Perfis de teste em memória com limites (`cliente_vip`, `cliente_padrao`, `cliente_sem_saldo` em `users.ts`).
  - Emissão e verificação de JWT (HS256) com validade de 1h (`jwt.ts`).
  - Middleware `requireAuth` para proteção de rotas privadas (`middleware.ts`).
  - Rotas `POST /api/auth/login` e `GET /api/user/me` (`routes/authRoutes.ts`).
- [x] **Cliente MCP & Suíte de Testes:**
  - `src/mcp/client.ts`: conexão Stateless HTTP (`POST /mcp`), descoberta de tools (`toOllamaTools`) e execução remota (`runMcpTool`).
  - Organização dos testes em `src/tests/` (`auth.test.ts` e `mcp.test.ts`).
- [x] **Orquestrador LLM & Rota de Chat Streaming:**
  - `src/llm/prompts.ts`: System Prompt especializado de vendas em português.
  - `src/llm/agentService.ts`: Loop autônomo do agente com Ollama (streaming NDJSON + execução de tools até `MAX_ROUNDS = 4`).
  - `src/routes/chatRoutes.ts`: Endpoint `POST /api/chat` autenticado via `requireAuth`.
  - `src/server.ts`: Servidor Express montado com rotas de auth, perfil e chat.

---

## 👩‍💻 Trilha Pessoa B — Frontend & Interface

- [x] **Contrato de Interface Atualizado ([contrato-api.md](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/docs/fase-1-bootcamp/contrato-api.md))**
- [ ] **Setup React + Vite + TypeScript na pasta `frontend/`**
- [ ] **Tela de Login com seleção rápida dos 3 perfis de teste**
- [ ] **Interface do Chat com componentes visuais de saldo, mensagens e tools**

---

## 📅 Próximos Marcos

- **Sábado 29/08 (Dia 3 — MARCO CRÍTICO):** Integração Backend + LLM (Ollama) + Servidor MCP + Frontend.
- **Domingo 30/08 (Dia 4):** Bateria dos 10 testes mandatórios e de segurança.
- **Segunda 31/08 (Dia 5):** Freeze de código, captura das 3 screenshots obrigatórias e escrita do README final.
- **Terça 01/09 (Dia 6):** Teste de clone limpo e entrega do projeto.
