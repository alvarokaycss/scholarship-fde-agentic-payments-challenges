# AGENTS.md — Diretrizes de Engenharia e Navegação do Repositório

> **Projeto:** Nexus Store — Chatbot com Tools MCP de Pagamentos  
> **Workspace Local:** `C:\Users\kaycs\Dev\lab-chatbot-payments`  
> **Contexto de Formação:** Compass UOL · AI/R Fellowship 2026 · AWS AI FDE (Sprint 2)  
> **Segundo Cérebro & Vault:** `C:\Users\kaycs\Dev\vault\DevObsidian`

---

## 1. Instrução Central para Agentes de IA

Este repositório vive um momento de **transição arquitetural controlada**:
* **Fase 1 (Concluída - Bootcamp):** Aplicação executada 100% localmente com React 19, Express, Ollama local (`qwen3:1.7b`) e servidor MCP em processo separado (`mcp-tools/`).
* **Fase 2 (Em Andamento - Desafio 1):** Migração para a nuvem da AWS orientada a Serverless, utilizando AWS CDK v2, Bedrock AgentCore, Strands Agents, Claude Haiku, Lambdas, DynamoDB, Cognito e S3 + CloudFront (OAC).

> [!IMPORTANT]
> **Nunca confunda os backends.** O código em `backend/` e `mcp-tools/` pertence à Fase 1 e deve ser mantido como referência funcional. A nova infraestrutura e lógica de nuvem da Fase 2 deve ser construída nos módulos específicos (`infra/`, `api/`, `agent/`, `tools/`).

---

## 2. Mapa do Repositório & Responsabilidade de Pastas

```text
lab-chatbot-payments/
├── AGENTS.md                 # Este arquivo (bússola para agentes de IA)
├── README.md                 # Visão geral do produto e instruções de execução
├── docs/                     # Documentação viva e histórica do projeto
│   ├── fase-1-bootcamp/      # Requisitos, contratos, kanban e notas da Fase 1
│   ├── fase-2-desafio-1-aws/ # Especificação oficial do Desafio 1 e ADRs
│   │   ├── adr/              # Architecture Decision Records (ADR-0001, etc.)
│   │   └── desafio-1-aws.pdf # Enunciado oficial atualizado da Sprint 2
│   └── screenshots/          # Evidências visuais de execução
│
├── frontend/                 # [FASE 1 & 2] SPA em React 19 + TypeScript + Vite
│                             # (Design System, rotas protegidas, streaming NDJSON nativo)
│
├── backend/                  # [FASE 1] Servidor Express local + loop manual ReAct com Ollama
├── mcp-tools/                # [FASE 1] Servidor MCP local HTTP (porta 3001) com Maps em memória
│
├── infra/                    # [FASE 2] Infraestrutura como Código (AWS CDK v2 em TypeScript)
├── api/                      # [FASE 2] Lambda de streaming do chat atrás do API Gateway
├── agent/                    # [FASE 2] Agente Strands implantado no Bedrock AgentCore Runtime
└── tools/                    # [FASE 2] Handlers das 3 Lambdas de ferramentas integradas ao DynamoDB
```

---

## 3. Regras e Restrições Inegociáveis do Desafio 1 (AWS)

Ao propor código, arquitetura ou comandos de infraestrutura, os agentes **devem seguir estritamente**:

1. **Região Obrigatória:** Todos os recursos sem exceção devem ser criados em **`us-east-1`** (Norte da Virgínia).
2. **Prefixagem Obrigatória:** Como a conta AWS da Compass é compartilhada entre vários fellows, todos os recursos (stacks do CloudFormation, buckets S3, tabelas DynamoDB, roles e user pools) **devem usar o prefixo `alvaro-`** (ex: `alvaro-chat-api`, `alvaro-users-table`).
3. **Menor Privilégio no IAM (Proibição de Curingas):**
   * **Proibido** utilizar `"Action": "*"` com `"Resource": "*"`.
   * **Proibido** anexar políticas amplas como `AdministratorAccess`.
   * **Lambda do Chat (`api/`):** Deve ter permissão apenas para invocar o runtime do agente e ler/escrever na tabela de conversas. **Não deve** acessar tabelas financeiras nem invocar o Bedrock diretamente.
   * **Role do AgentCore Runtime (`agent/`):** Deve ter permissão para invocar o Bedrock (`claude-haiku`) e invocar as Lambdas de tools. **Não deve** ter acesso direto às tabelas do DynamoDB.
   * **Lambdas de Tools (`tools/`):** Devem ler e escrever apenas nas tabelas específicas que utilizam.
4. **Origem da Identidade e Segurança Financeira:**
   * O `usuario_id` deve ser extraído **obrigatoriamente da claim `sub` do token JWT** do Cognito na Lambda da API, **nunca** do payload enviado pelo cliente.
   * O valor da transação deve vir da intenção salva no banco, **nunca** de parâmetros preenchidos pela LLM.
   * As deduções de saldo e pagamentos de intenção devem usar **escritas condicionais atômicas no DynamoDB** para evitar duplicidade.
5. **Autenticação Fechada (Cognito):**
   * O User Pool deve ser provisionado com `selfSignUpEnabled: false` (`AllowAdminCreateUserOnly: true`). O cadastro é exclusivamente por convite administrativo.
6. **Borda e Frontend:**
   * A hospedagem em nuvem utiliza **Amazon S3 (privado) + Amazon CloudFront com Origin Access Control (OAC)**. O bucket não pode ser público nem usar hosting estático do S3.
   * A comunicação deve passar obrigatoriamente pelo **Amazon API Gateway** (REST API com `ResponseTransferMode: STREAM` ou HTTP API com authorizer JWT do Cognito).

---

## 4. Comandos de Verificação & Rotinas de Desenvolvimento

### Frontend (`frontend/`):
```bash
# Rodar suíte de testes unitários (Vitest - 24 testes)
npm --prefix frontend test

# Validar linting e formatação
npm --prefix frontend run lint
```

### AWS CLI & Sessão SSO:
```bash
# Login na conta sandbox da Compass (us-east-1)
aws sso login --profile alvaro-fellowship

# Verificar identidade e role ativa
aws sts get-caller-identity --profile alvaro-fellowship
```

### Infraestrutura (`infra/`):
```bash
# Sintetizar CloudFormation e validar tipos localmente (100% offline)
npx cdk synth

# Comparar com o ambiente em nuvem
npx cdk diff --profile alvaro-fellowship

# Deploy controlado na nuvem
npx cdk deploy --profile alvaro-fellowship
```

---

## 5. Diretrizes de Postura e Governança

1. **Rigor Epistêmico e Sobriedade:** Avalie propostas com fundamentação técnica e clareza de trade-offs. Evite elogios vazios ou complexidade prematura (YAGNI).
2. **Consentimento Prévio para Push Remoto:** **NUNCA** execute `git push`, publicação de branches ou deploy em contas remotas sem autorização explícita de Álvaro. Commits locais e comandos de síntese (`cdk synth`) são encorajados.
3. **Evidência Antes de Asserção:** Teste e valide localmente a sintaxe, imports e integridade de tipos antes de declarar qualquer tarefa como concluída.
