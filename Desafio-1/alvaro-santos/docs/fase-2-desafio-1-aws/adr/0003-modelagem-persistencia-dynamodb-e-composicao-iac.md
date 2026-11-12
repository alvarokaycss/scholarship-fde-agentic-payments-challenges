---
title: "ADR-0003: Modelagem de Persistência no DynamoDB e Estratégia de Composição de Construtos CDK"
tags:
  - adr
  - arquitetura
  - dynamodb
  - cdk
  - iac
  - seguranca
  - menor-privilegio
  - agentic-payments
created: 2026-11-11
updated: 2026-11-11
status: aceito
type: adr
projeto: lab-chatbot-payments
decisor: Álvaro Kayc
data_decisao: 2026-11-11
---

# ADR-0003: Modelagem de Persistência no DynamoDB (Multi-Table, On-Demand, TTL) e Composição de Construtos CDK

> 📂 **Localização:** `docs/fase-2-desafio-1-aws/adr/0003-modelagem-persistencia-dynamodb-e-composicao-iac.md`  
> 🔗 **Documentos Relacionados:** [ADR-0001 (IaC CDK v2)](file:///docs/fase-2-desafio-1-aws/adr/0001-estrategia-iac-cdk-v2.md), [ADR-0002 (Strangler Pattern)](file:///docs/fase-2-desafio-1-aws/adr/0002-estrategia-migracao-coexistencia-modulos.md), [AGENTS.md](file:///AGENTS.md), [Desafio 1 AWS (PDF)](file:///docs/fase-2-desafio-1-aws/desafio-1-aws.pdf)  
> 🧭 **Contexto de Estágio:** Sprint 2 (Semana 2 — Quinzena 1) · Trilha AWS AI FDE Agentic Payments

---

## 1. Contexto e Forças Determinantes

A transição da aplicação local da Fase 1 para a nuvem da AWS (Fase 2 - Desafio 1) exige que o estado em memória (`Map` de usuários, saldo e intenções de compra) seja substituído por um mecanismo de persistência gerenciado, durável e escalável horizontalmente no **Amazon DynamoDB**.

As forças arquiteturais que orientam a decisão incluem:
1. **Menor Privilégio no IAM (Guardrail Inegociável):** A conta da Compass é compartilhada. As funções Lambda que executam ferramentas do agente possuem responsabilidades estritamente delimitadas:
   - A tool de saldo (`consultar_saldo`) precisa apenas ler limites de usuários.
   - A tool de intenção (`registrar_intencao`) precisa apenas gravar intenções de compra.
   - A tool de liquidação (`confirmar_pagamento`) precisa validar a intenção e debitar o saldo de forma atômica e condicional.
   - A Lambda da API de chat precisa apenas consultar e persistir o histórico da sessão de mensagens.
2. **Ciclo de Vida de Intenções Abandonadas:** Intenções de compra não pagas em até 15 minutos devem expirar e ser descartadas sem intervenção manual e sem incorrer em custos operacionais contínuos.
3. **Padrão de Implantação e Teardown (IaC):** O edital exige provisionamento em comando único e remoção completa (`cdk destroy`) sem resíduos ou deadlocks de dependência de recursos na conta.

Diante desse cenário, duas encruzilhadas de arquitetura foram avaliadas:
- **Encruzilhada 1 (Persistência):** *Multi-Table Design* (3 tabelas dedicadas) vs. *Single-Table Design* (1 tabela sobrecarregada com chaves genéricas `PK`/`SK`).
- **Encruzilhada 2 (IaC / CloudFormation):** *Composição de Construtos em Stack Única* vs. *Multi-Stack CloudFormation com referências cruzadas*.

---

## 2. Decisão

### 2.1 Persistência: Adoção de Multi-Table Design (3 Tabelas Dedicadas) com Billing On-Demand e TTL
Decidiu-se pela criação de **três tabelas independentes** no DynamoDB, rejeitando o padrão de Single-Table Design:
1. **`alvaro-usuarios`:**
   - **Partition Key:** `usuario_id` (String) — extraído obrigatoriamente da claim `sub` do token JWT do Cognito.
   - **Finalidade:** Saldo total, saldo disponível e dados de identificação.
2. **`alvaro-intencoes`:**
   - **Partition Key:** `intencao_id` (String) — UUID v4 determinístico gerado no backend.
   - **TTL Nativo:** Atributo `expires_at` (inteiro em segundos Epoch Unix) habilitado para expiração automática em background.
   - **Finalidade:** Pré-autorização e trava de valor da compra.
3. **`alvaro-conversas`:**
   - **Partition Key:** `session_id` (String).
   - **TTL Nativo:** Atributo `expires_at` para descarte de sessões inativas.
   - **Finalidade:** Histórico conversacional do chat consumido pelo Bedrock.

- **Modo de Faturamento:** `BillingMode.PAY_PER_REQUEST` (On-Demand) em todas as tabelas, garantindo custo zero em repouso e prevenção de estrangulamento de throughput.
- **Política de Remoção:** `RemovalPolicy.DESTROY` explícita, viabilizando o teardown determinístico do ambiente de avaliação.

### 2.2 IaC: Composição de Construtos em Stack Raiz Única (`AgenticPaymentsStack`)
Decidiu-se encapsular o DynamoDB no construto L3 `PaymentsDatabase extends Construct` (`infra/lib/database.ts`), instanciado diretamente dentro da stack única `AgenticPaymentsStack` (`infra/lib/root-stack.ts`), rejeitando a divisão em Stacks CloudFormation separadas (`DatabaseStack`, `ApiStack`, `AuthStack`).

---

## 3. Comparativo de Alternativas e Trade-offs

### 3.1 Multi-Table Design (Escolhida) vs. Single-Table Design (Descartada)

| Critério de Avaliação | Multi-Table Design (3 Tabelas) | Single-Table Design (1 Tabela) |
|---|:---:|:---:|
| **Menor Privilégio no IAM** | ✅ **Excelente.** Grants pontuais via `table.grantReadData()` isolados por Lambda. | ❌ **Crítico.** Todas as Lambdas acessam a mesma tabela física, exigindo políticas com condições complexas em `LeadingKeys`. |
| **Isolamento de Falha (Blast Radius)** | ✅ **Total.** Falhas na tabela de conversas não impactam pagamentos. | ⚠️ **Compartilhado.** Throttling ou partição quente afeta chat e checkout simultaneamente. |
| **Simplicidade de Modelagem (YAGNI)** | ✅ **Alta.** Chaves semânticas naturais (`usuario_id`, `intencao_id`, `session_id`). | ❌ **Baixa.** Exige sobrecarga de chaves sintéticas (`PK=USER#123`, `SK=METADATA`). |
| **Ciclo de Vida e TTL** | ✅ **Independente.** TTL ativado apenas onde há descarte real (`intencoes`, `conversas`). | ⚠️ **Misto.** Registros perenes e efêmeros coabitam a mesma tabela. |
| **Custo On-Demand** | **Idêntico.** O faturamento On-Demand cobra por requisições feitas, não por quantidade de tabelas. | **Idêntico.** |

### 3.2 Stack Única com Construtos (Escolhida) vs. Multi-Stack CloudFormation (Descartada)

* **Vantagens da Stack Única via Construtos L3:**
  1. **Zero Deadlocks de Export Lock:** No CloudFormation, quando a `ApiStack` consome um ARN da `DatabaseStack` via `Fn::ImportValue`, o CloudFormation bloqueia qualquer alteração estrutural no banco até que a stack dependente seja destruída. A stack única orquestra recursos na mesma árvore sem export locks.
  2. **Deploy e Teardown Atômicos:** `cdk deploy` e `cdk destroy` operam em lote único sem necessidade de scripts de orquestração de dependências topológicas.
  3. **Código Limpo e Modular:** A separação física de arquivos (`database.ts`, `auth.ts`, `api.ts`) é preservada no TypeScript sem transferir acoplamento para o CloudFormation.

---

## 4. Consequências da Decisão

### Consequências Positivas:
- As Lambdas de ferramentas financeiras (`tools/`) recebem políticas IAM com escopo mínimo inegociável, cumprindo estritamente o edital da Sprint 2.
- Intenções de compra abandonadas e sessões antigas são deletadas pela própria infraestrutura interna da AWS com custo zero (sem consumo de WCU e sem necessidade de Lambdas Janitor).
- O teardown do desafio (`cdk destroy`) é 100% confiável e não deixa tabelas nem dependências presas na conta compartilhada.

### Consequências Negativas / Mitigações:
- **Sobrecarga de Nomenclatura:** Três tabelas físicas na AWS exigem injeção de três variáveis de ambiente nas Lambdas (`TABLE_USUARIOS`, `TABLE_INTENCOES`, `TABLE_CONVERSAS`).  
  *Mitigação:* O construto `PaymentsDatabase` expõe referências tipadas públicas (`usuariosTable.tableName`), injetadas diretamente nas propriedades de ambiente das Lambdas pelo CDK.
