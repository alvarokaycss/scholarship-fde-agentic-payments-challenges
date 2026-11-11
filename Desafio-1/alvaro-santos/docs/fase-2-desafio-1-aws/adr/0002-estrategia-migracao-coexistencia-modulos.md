---
title: "ADR-0002: Estratégia de Migração por Coexistência Paralela (Strangler Pattern) entre Fase 1 e Fase 2"
tags:
  - adr
  - arquitetura
  - migracao
  - strangler-pattern
  - aws
  - serverless
  - agentic-payments
created: 2026-11-11
updated: 2026-11-11
status: aceito
type: adr
projeto: lab-chatbot-payments
decisor: Álvaro Kayc
data_decisao: 2026-11-11
---

# ADR-0002: Estratégia de Migração por Coexistência Paralela (Strangler Pattern) entre Fase 1 e Fase 2

> 📂 **Localização:** `docs/fase-2-desafio-1-aws/adr/0002-estrategia-migracao-coexistencia-modulos.md`  
> 🔗 **Documentos Relacionados:** [ADR-0001 (IaC com CDK v2)](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/docs/fase-2-desafio-1-aws/adr/0001-estrategia-iac-cdk-v2.md), [AGENTS.md](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/AGENTS.md), [Desafio Fase 1](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/docs/fase-1-bootcamp/desafio.md), [Desafio 1 AWS (PDF)](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/docs/fase-2-desafio-1-aws/desafio-1-aws.pdf)  
> 🧭 **Contexto de Estágio:** Sprint 2 (Semana 2 — Quinzena 1) · Trilha AWS AI FDE Agentic Payments

---

## 1. Contexto e Forças Determinantes

A entrega da **Fase 1 (Bootcamp)** estabeleceu uma aplicação funcional completa em ambiente 100% local:
- `frontend/`: SPA em React 19 + TypeScript + Vite, consumindo streaming NDJSON.
- `backend/`: Servidor Node.js com Express e loop ReAct manual orquestrado contra Ollama local (`qwen3:1.7b`).
- `mcp-tools/`: Servidor HTTP standalone expondo 3 ferramentas de pagamento (`consultar_saldo`, `criar_intencao_pagamento`, `confirmar_pagamento`) com dados em memória (`Map`).

Para a **Fase 2 (Desafio 1 - AWS)**, os requisitos exigem uma transição estrutural para a nuvem da AWS orientada a Serverless e padrões corporativos:
- O loop orquestrado do backend Express é substituído pelo **Strands Agent** hospedado no **Bedrock AgentCore Runtime** com Claude Haiku.
- A camada de API deixa de ser um processo Express contínuo e passa a ser uma **AWS Lambda de streaming** (`api/`) atrás do **Amazon API Gateway** com autorizador Cognito JWT.
- O servidor MCP em memória (`mcp-tools/`) é decomposto em **3 funções AWS Lambda independentes** (`tools/`), integradas ao **Amazon DynamoDB** com escritas condicionais atômicas.
- Toda a infraestrutura é provisionada como código via **AWS CDK v2** (`infra/`).

Diante dessa discrepância de paradigmas de execução (processos locais contínuos em memória vs. funções serverless efêmeras e agentes gerenciados em nuvem), surge a decisão de engenharia sobre como conduzir a evolução do código no repositório:
- **Abordagem A (Refatoração In-Place):** Reescrever o código diretamente dentro de `backend/` e `mcp-tools/`, adaptando-os para a AWS.
- **Abordagem B (Substituição Big Bang):** Descartar o código da Fase 1 ou isolá-lo em uma branch antiga e iniciar a Fase 2 do zero.
- **Abordagem C (Coexistência Paralela / Strangler Pattern):** Preservar `backend/` e `mcp-tools/` intactos como linha de base funcional da Fase 1 e criar novos diretórios dedicados (`infra/`, `api/`, `agent/`, `tools/`) para a Fase 2, utilizando o `frontend/` compartilhado com alternância por variáveis de ambiente.

---

## 2. Decisão

Decidiu-se pela **Abordagem C: Coexistência Paralela orientada pelo Strangler Pattern**:

1. **Imutabilidade Funcional da Fase 1:**
   - As pastas `backend/` e `mcp-tools/` permanecem inalteradas e operacionais para execução local com Ollama.
   - Nenhuma dependência da AWS será injetada em `backend/` ou `mcp-tools/`.

2. **Novos Módulos Dedicados para a Fase 2:**
   - `infra/`: Infraestrutura como Código via AWS CDK v2 em TypeScript.
   - `api/`: Handler da AWS Lambda de streaming HTTP (NDJSON) acoplada ao API Gateway.
   - `agent/`: Definição do agente Strands, prompts de sistema e integração com Bedrock AgentCore Runtime.
   - `tools/`: Handlers das 3 Lambdas de ferramentas financeiras com persistência no DynamoDB.

3. **Frontend Híbrido e Desacoplado (`frontend/`):**
   - O mesmo cliente React 19 continuará sendo a interface unificada da aplicação.
   - A alternância entre o backend local da Fase 1 e a infraestrutura AWS da Fase 2 será realizada estritamente por variáveis de ambiente (`.env.local` vs `.env.production`):
     - `VITE_API_URL` apontando para `http://localhost:3000` (Fase 1) ou para o endpoint do `API Gateway` (Fase 2).
     - Mecanismo de autenticação alternando entre mock de desenvolvimento local e tokens reais emitidos pelo Cognito User Pool.

4. **Alinhamento com a Estrutura do Desafio:**
   - Essa separação física mapeia diretamente os requisitos do PDF oficial do Desafio 1 (`fellows/<seu-nome>/` com `frontend/`, `api/`, `agent/`, `tools/`, `infra/`), simplificando a preparação do pacote de entrega.

---

## 3. Comparativo de Alternativas e Trade-offs

| Critério de Avaliação | Abordagem A: Refatoração In-Place | Abordagem B: Big Bang / Branch Separada | Abordagem C: Coexistência Paralela (Escolhida) |
|---|---|---|---|
| **Integridade da Fase 1** | ❌ Destruída. Impossível rodar o demo local original. | ⚠️ Preservada apenas no histórico do Git. | ✅ **100% Preservada.** Roda localmente a qualquer momento. |
| **Risco de Regressão** | ❌ Alto. Mistura runtime Express com contratos de Lambda. | ⚠️ Médio. Dificuldade de comparar comportamentos. | ✅ **Mínimo.** Código novo isolado em pastas novas. |
| **Complexidade de Código** | ❌ Alta. Exigiria condicionais `if (isAws)` e poluição de deps. | ⚠️ Baixa, mas perde continuidade visual. | ✅ **Baixa.** Cada módulo tem responsabilidade e dependências únicas. |
| **Facilidade de Avaliação** | ❌ Ruim. Avaliadores não conseguem auditar a Fase 1 e 2 no mesmo checkout. | ⚠️ Regular. Exige troca de branches para validação. | ✅ **Excelente.** Ambos os estágios são navegáveis e auditáveis lado a lado. |
| **Alinhamento com Entrega** | ❌ Desalinhado da taxonomia de pastas solicitada na Sprint 2. | ⚠️ Parcial. | ✅ **Total.** Módulos espelham a convenção exigida pela Compass. |

---

## 4. Detalhamento dos Módulos da Fase 2

```text
lab-chatbot-payments/
├── frontend/                 # [COMPARTILHADO] React 19 + TypeScript + Vite
│                             # Consome Fase 1 (local) ou Fase 2 (API Gateway + Cognito)
│
├── backend/                  # [FASE 1] Express local + ReAct loop + Ollama (congelado)
├── mcp-tools/                # [FASE 1] Servidor HTTP MCP em memória (congelado)
│
├── infra/                    # [FASE 2] AWS CDK v2 (Stacks: Auth, API, AgentCore, Storage, Tools)
├── api/                      # [FASE 2] Lambda Node.js/TS para Streaming de Chat via API Gateway
├── agent/                    # [FASE 2] Strands Agent implantado no Bedrock AgentCore Runtime
└── tools/                    # [FASE 2] Handlers Lambda para as 3 tools conectadas ao DynamoDB:
    ├── consultar-saldo/
    ├── criar-intencao/
    └── confirmar-pagamento/
```

### Contrato de Responsabilidade entre Módulos:
1. **`api/` (Chat Lambda):**
   - Recebe a requisição autenticada do API Gateway.
   - Extrai a identidade do usuário exclusivamente da claim `sub` do JWT (Cognito Authorizer).
   - Inicia a sessão no Bedrock AgentCore Runtime e faz o streaming da resposta em NDJSON de volta ao cliente.
   - **Restrição de Menor Privilégio:** Não tem acesso direto ao DynamoDB financeiro nem ao Bedrock raw.
2. **`agent/` (AgentCore Runtime):**
   - Executa o loop de raciocínio do modelo Foundation (Claude Haiku).
   - Invoca as ferramentas via AgentCore Gateway (protocolo MCP/Lambda).
   - **Restrição de Menor Privilégio:** Não possui credenciais diretas no DynamoDB; sua única via de ação é disparar as Lambdas de tools autorizadas.
3. **`tools/` (Lambdas de Ferramentas):**
   - Executam a lógica de negócio e persistência no DynamoDB com expressões condicionais (`attribute_exists`, verificação atômica de saldo).
   - Isolamento total por função: cada Lambda acessa apenas a tabela ou partição necessária.

---

## 5. Consequências e Mitigações

### Consequências Positivas:
- **Zero Regressão:** O ambiente de testes locais construído na Fase 1 não sofre interrupções.
- **Desenvolvimento Incremental:** A infraestrutura CDK (`infra/`) e as Lambdas (`tools/`, `api/`) podem ser sintetizadas, tipadas e testadas unitariamente sem quebrar o build existente.
- **Rastreabilidade e Didática:** Evidencia com clareza a evolução de uma arquitetura baseada em container/servidor local monolítico para uma arquitetura nativa em nuvem serverless desacoplada.

### Riscos Identificados e Mitigações:
- **Risco de Duplicação de Tipos/Contratos:** DTOs de pagamento e schemas de requisição podem divergir entre `mcp-tools/` e `tools/`.  
  *Mitigação:* Usar os mesmos esquemas Zod e contratos de interface já validados em `docs/fase-1-bootcamp/contrato-api.md`.
- **Risco de Confusão por Agentes de IA ou Desenvolvedores:** Modificar por engano `backend/` achando que se trata da Lambda da Fase 2.  
  *Mitigação:* O documento [`AGENTS.md`](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/AGENTS.md) estabelece a regra de isolamento explicitamente na raiz do repositório, com alerta inegociável contra alterações em `backend/`.

---

## 6. Próximos Passos Imediatos

1. Manter `backend/` e `mcp-tools/` congelados na branch atual.
2. Inicializar o pacote `infra/` com AWS CDK v2 em TypeScript para provisionar a fundação da Fase 2:
   - Stack de Autenticação (`Cognito User Pool` fechado com `selfSignUpEnabled: false`).
   - Stack de Borda (`API Gateway REST` com suporte a streaming e autorizador JWT).
3. Construir as Lambdas em `tools/` com foco em testes unitários e escritas condicionais no DynamoDB.
