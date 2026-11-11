---
title: "ADR-0001: Adoção do AWS CDK v2 Puro (infra/) para o Desafio 1"
tags:
  - adr
  - arquitetura
  - iac
  - aws
  - cdk
  - amplify
  - cognito
  - agentic-payments
created: 2026-11-10
updated: 2026-11-11
status: aceito
type: adr
projeto: lab-chatbot-payments
decisor: Álvaro Kayc
data_decisao: 2026-11-10
---

# ADR-0001: Adoção do AWS CDK v2 Puro (`infra/`) em vez de Amplify Gen 2 Nativo

> 📂 **Localização:** `docs/fase-2-desafio-1-aws/adr/0001-estrategia-iac-cdk-v2.md`  
> 🔗 **Documentos Relacionados:** [Desafio Fase 1](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/docs/fase-1-bootcamp/desafio.md), [Arquitetura Frontend](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/docs/fase-1-bootcamp/arquitetura-frontend.md), [Contrato da API](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/docs/fase-1-bootcamp/contrato-api.md), [Desafio 1 AWS (PDF)](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/docs/fase-2-desafio-1-aws/desafio-1-aws.pdf)  
> 🧭 **Contexto de Estágio:** Sprint 2 (Semana 2 — Quinzena 1) · Trilha AWS AI FDE Agentic Payments

---

## 1. Contexto e Forças Determinantes

A Fase 1 do projeto consolidou uma aplicação funcional local composta por:
- **Frontend:** SPA em React 19 + TypeScript + Vite (`frontend/`).
- **Backend:** Servidor Express + loop manual ReAct com Ollama local (`backend/`).
- **MCP Server:** Servidor HTTP com 3 ferramentas de pagamentos e dados em memória (`mcp-tools/`).

Para a **Fase 2 (Desafio 1)**, o objetivo normativo é migrar essa arquitetura para a nuvem da AWS com padrão de produção:
1. **Frontend:** Hospedado no AWS Amplify (ou distribuição CDN equivalente com CI/CD).
2. **Autenticação:** Amazon Cognito User Pool com clientes públicos e PKCE.
3. **Borda (API):** Amazon API Gateway REST/HTTP com autorizador JWT e suporte a **streaming contínuo (NDJSON)**.
4. **Cérebro Agêntico:** Agente Strands no Amazon Bedrock AgentCore consumindo Foundation Models do Bedrock.
5. **Ferramentas:** 3 funções AWS Lambda integradas ao AgentCore Gateway via MCP.
6. **Persistência:** Amazon DynamoDB (tabelas com billing on-demand e TTL).
7. **Governança:** Toda a infraestrutura como código (IaC) com menor privilégio no IAM.

Surgiu a decisão arquitetural sobre a tecnologia de IaC e estruturação do projeto:
- **Opção 1:** Adotar **AWS CDK v2 puro em TypeScript**, isolado na pasta `infra/`.
- **Opção 2:** Adotar **Amplify Gen 2 nativo**, gerenciado na pasta `amplify/` via CLI `ampx` e `@aws-amplify/backend`.

### Forças e Restrições Atuais:
- **Ambiente de Estágio e Credenciais:** No estágio da Compass UOL, a conta corporativa de sandbox e as permissões ativas de deploy na nuvem têm janelas específicas de liberação. A equipe necessita de **validação estrita e determinística 100% offline** (via síntese de templates).
- **Streaming HTTP NDJSON:** A experiência de conversação depende de streaming contínuo linha a linha (Web Streams API). O API Gateway precisa de configuração explícita de `ResponseTransferMode: STREAM` para manter o socket aberto até 5 minutos sem buffering prematuro.
- **Integração com Bedrock AgentCore:** O ecossistema AgentCore é suportado via construtos específicos do CDK (`aws-cdk-lib/aws-bedrockagentcore`), que expõem portas, protocolos e alvos Lambda MCP.

---

## 2. Decisão

Decidiu-se pela **Adoção do AWS CDK v2 puro em TypeScript**, organizado em uma pasta dedicada `infra/` na raiz do repositório, rejeitando o uso do framework Amplify Gen 2 nativo (`amplify/` / `ampx`).

O frontend continuará sendo tratado como uma aplicação estática desacoplada (`frontend/`), cujo artefato compilado (`dist/`) poderá ser conectado ao construto de **Amplify Hosting** ou **S3 + CloudFront com OAC** gerenciado diretamente pela stack CDK.

---

## 3. Comparativo de Alternativas e Trade-offs

### Alternativa 1: AWS CDK v2 Puro em `infra/` (Escolhida)

* **Vantagens:**
  1. **Controle Total de Menor Privilégio no IAM:** Permissões granulares sem criação implícita de roles coringa (`*`). Concessão pontual via métodos idiomáticos (`table.grantReadWriteData()`, `gateway.grantInvoke()`, políticas restritas a inference profiles do Bedrock).
  2. **Suporte Nativo a Recursos Especializados:** Permite configurar diretamente `apigw.ResponseTransferMode.STREAM` e instanciar construtos L2/CFN de `aws-bedrockagentcore` sem necessidade de pontes ou "hacks".
  3. **Validação Offline Imediata (`cdk synth`):** Conforme alinhado no laboratório prático (`lab-cdk-serverless-hello`), o comando `cdk synth` compila o TypeScript e valida tipos, esquemas e parâmetros, gerando o CloudFormation em `cdk.out/` sem exigir credenciais de nuvem ou execução de `bootstrap`.
  4. **Desacoplamento do Frontend:** O frontend React permanece puro e leve, sem carregar dependências invasivas de SDK do Amplify no bundle do navegador, bastando ler variáveis de ambiente (`VITE_API_URL`, `VITE_USER_POOL_ID`).
  5. **Alinhamento com a Referência da Formação:** Segue exatamente a mesma arquitetura validada no repositório de workshops da trilha (`PedroLeale/agentic-payments-aws`).

* **Desvantagens e Custos:**
  1. Maior verbosidade inicial de código de infraestrutura (necessidade de declarar formalmente cada construto de rede, CORS e GatewayResponses).
  2. Não há injeção automática de `amplify_outputs.json`; a configuração do frontend depende de mapear as `CfnOutput` do CDK para o `.env`.

---

### Alternativa 2: Amplify Gen 2 Nativo (`amplify/` via `ampx`) (Descartada)

* **Vantagens Teóricas:**
  1. Declaração simplificada de autenticação com `defineAuth` e geração automática de arquivo de configuração tipado para o frontend.
  2. Experiência unificada orientada ao desenvolvedor web full-stack.

* **Motivos da Rejeição:**
  1. **Complexidade Acidental por Dupla Abstração:** O Amplify Gen 2 não possui abstrações de alto nível para recursos como **streaming contínuo em API Gateway REST** nem para o **AgentCore Gateway MCP**. Para utilizá-los, seria obrigatório criar Stacks CDK customizadas via `backend.createStack()`, operando como um "CDK disfarçado" dentro do Amplify.
  2. **Dependência de Nuvem para Validação (`ampx sandbox`):** O fluxo de desenvolvimento local do Amplify Gen 2 depende fortemente do comando `npx ampx sandbox`, que exige uma conta AWS conectada em tempo real para provisionar recursos efêmeros a cada alteração, inviabilizando o trabalho na ausência da conta de sandbox corporativa.
  3. **Acoplamento do Bundle do Frontend:** Tende a forçar a instalação de bibliotecas `@aws-amplify/*` no cliente React, aumentando o tamanho do bundle e contrariando a premissa de zero-overhead adotada no frontend da Nexus Store.

---

## 4. Matriz de Avaliação Técnica

| Dimensão de Engenharia | AWS CDK v2 (`infra/`) | Amplify Gen 2 (`amplify/`) | Impacto no Projeto |
|---|:---:|:---:|---|
| **Controle de IAM (Menor Privilégio)** | **Alto (Explícito)** | Médio (Automatizado) | O CDK permite isolar ARNs de inference profiles do Bedrock. |
| **Suporte a Streaming HTTP NDJSON** | **Nativo (`STREAM`)** | Inexistente nativamente | CDK suporta `ResponseTransferMode: STREAM`. |
| **Integração Bedrock AgentCore** | **Direta via CDK L2** | Exige Stack Customizada | CDK evita "gambiarras" de bridge no Gen 2. |
| **Validação sem Conexão AWS** | **Sim (`cdk synth`)** | Não (`sandbox` requer AWS) | Permite avançar o código mesmo sem sandbox ativa. |
| **Complexidade e Acoplamento** | **Baixo (Modular)** | Alto (Dupla abstração) | `infra/` vive isolada sem poluir o React. |

---

## 5. Consequências e Próximos Passos

### Consequências Positivas:
- O repositório ganha uma pasta `infra/` independente com seu próprio `package.json`, `tsconfig.json` e pipeline de compilação.
- O código da Fase 1 (`backend/`, `frontend/`, `mcp-tools/`) permanece 100% funcional localmente, sem regressões.
- A infraestrutura pode ser testada com suítes unitárias via `@aws-cdk/assertions`.

### Riscos e Mitigações:
- **Risco:** Desconexão manual entre as saídas da Stack e o `.env` do frontend.  
  *Mitigação:* Configurar a Stack CDK para gerar um arquivo de configuração JSON estruturado ou um script simples de export de variáveis (`npm run config:local`).

### Plano de Ação Imediato:
1. Criar o diretório `infra/` e inicializar o projeto CDK em TypeScript com dependências mínimas (`aws-cdk-lib`, `constructs`).
2. Implementar a stack de borda inicial:
   - `Cognito User Pool` + `UserPoolClient` (fluxo PKCE para SPA).
   - `API Gateway REST` com autorizador JWT Cognito e tratamento de CORS em `GatewayResponses`.
3. Executar e validar a compilação local através de **`cdk synth`**.

---

## 6. Adendo de Atualização (11/11/2026) — Ratificação dos Requisitos Oficiais do Desafio 1

Após a apresentação oficial da Sprint 2 e publicação do enunciado definitivo ([Desafio 1 AWS (PDF)](file:///c:/Users/kaycs/Dev/lab-chatbot-payments/docs/fase-2-desafio-1-aws/desafio-1-aws.pdf)), os seguintes alinhamentos foram incorporados a esta decisão:

1. **Hospedagem Exclusiva via Amazon S3 + CloudFront (OAC):**
   - Fica descartado qualquer uso do console ou serviço do AWS Amplify Hosting.
   - O frontend React (`frontend/`) será compilado estaticamente e hospedado em um **bucket S3 100% privado** (com bloqueio total de acesso público), distribuído globalmente pelo **Amazon CloudFront** protegido com **Origin Access Control (OAC)**.
   - Toda essa infraestrutura de distribuição estática será gerenciada como construtos CDK nativos (`s3.Bucket`, `cloudfront.Distribution`, `origins.S3StaticWebsiteOrigin` / OAC) dentro da pasta `infra/`.

2. **Prefixagem Obrigatória de Recursos (`alvaro-`):**
   - Em conformidade com a política de governança em conta compartilhada (`006739439488`), todas as Stacks do CloudFormation, buckets S3 e recursos gerenciados devem conter o prefixo do autor (ex: `alvaro-frontend-bucket`, `alvaro-distribution`).

3. **Validação do Desacoplamento:**
   - O direcionamento oficial do programa consolidou a estrutura de entrega em `fellows/<seu-nome>/` dividida em `frontend/`, `api/`, `agent/`, `tools/` e `infra/`, validando retroativamente 100% da estratégia de isolamento de IaC adotada nesta ADR.

