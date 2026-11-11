#!/usr/bin/env bash
# =============================================================================
# Desafio 1 (Sprint 2 - AWS Cloud) · Trilha Pagamentos Agênticos
# Criação automatizada de Labels, Milestone e Backlog no GitHub Fork
#
# Repositório Alvo: alvarokaycss/scholarship-fde-agentic-payments-challenges
# Requisitos: GitHub CLI autenticado (gh auth login com escopo 'repo').
#
# Uso:
#   DRY_RUN=1 bash scripts/criar_backlog_desafio1.sh   # Simulação (não cria nada)
#   bash scripts/criar_backlog_desafio1.sh              # Criação real no GitHub
# =============================================================================
set -euo pipefail

REPO="${REPO:-alvarokaycss/scholarship-fde-agentic-payments-challenges}"
DRY_RUN="${DRY_RUN:-0}"
MILESTONE="Sprint 2 · Desafio 1 (AWS Cloud)"
MILESTONE_DUE="2026-11-20T23:59:59Z"
ASSIGNEE="alvarokaycss"

declare -A NUM TITULO FILHOS
CONTADOR=0

label() {
  local nome="$1" cor="$2" desc="$3"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] label: $nome"
  else
    gh label create "$nome" --repo "$REPO" --color "$cor" --description "$desc" --force >/dev/null
  fi
}

nova() {
  local id="$1" titulo="$2" labels="$3" assignees="$4" epico="${5:-}"
  local corpo; corpo="$(cat)"
  TITULO[$id]="$titulo"
  if [[ -n "$epico" ]]; then FILHOS[$epico]="${FILHOS[$epico]:-} $id"; fi

  if [[ "$DRY_RUN" == "1" ]]; then
    CONTADOR=$((CONTADOR + 1))
    NUM[$id]="$CONTADOR"
    echo "[dry-run] #$CONTADOR [$id] $titulo | $labels | ${assignees:-sem assignee}"
    return
  fi

  local args=(issue create --repo "$REPO" --title "[$id] $titulo" --body "$corpo"
              --label "$labels" --milestone "$MILESTONE")
  if [[ -n "$assignees" ]]; then args+=(--assignee "$assignees"); fi
  local url; url="$(gh "${args[@]}")"
  NUM[$id]="${url##*/}"
  echo "#${NUM[$id]} [$id] $titulo"
}

# =============================================================================
# 1. Labels
# =============================================================================
echo "== Configurando Labels no Repositório $REPO"
label "frente: infra"     "0052CC" "AWS CDK v2, TypeScript e arquitetura de stacks"
label "frente: auth"      "5319E7" "Amazon Cognito, User Pool, JWT e PKCE"
label "frente: borda"     "1D76DB" "API Gateway, CloudFront OAC e S3 privado"
label "frente: dados"     "0E8A16" "Amazon DynamoDB, persistência e escritas atômicas"
label "frente: agente"    "7057FF" "Bedrock AgentCore, Strands Agent e Claude Haiku"
label "frente: tools"     "FBCA04" "Funções AWS Lambda para ferramentas de pagamento"
label "frente: docs"      "0075CA" "README.md oficial, arquitetura e evidências"
label "tipo: epico"       "3E4B9E" "Agrupador macro de entregas da Sprint"
label "tipo: feature"     "A2EEEF" "Funcionalidade de código ou infraestrutura"
label "tipo: seguranca"   "B60205" "IAM menor privilégio, OAC e proteção de chaves"
label "prioridade: alta"  "B60205" "Bloqueia o fluxo principal da aplicação"
label "prioridade: media" "FBCA04" "Importante para qualidade e conformidade"

# =============================================================================
# 2. Milestone
# =============================================================================
echo "== Configurando Milestone: $MILESTONE"
if [[ "$DRY_RUN" == "1" ]]; then
  echo "[dry-run] milestone: $MILESTONE"
elif ! gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title' | grep -Fxq "$MILESTONE"; then
  gh api "repos/$REPO/milestones" -f title="$MILESTONE" -f due_on="$MILESTONE_DUE" \
    -f description="Desafio 1 (AWS Cloud): Chatbot de pagamentos agênticos com Bedrock AgentCore, Strands, DynamoDB e CDK v2." >/dev/null
fi

# =============================================================================
# 3. Épicos (Serão atualizados com links no final)
# =============================================================================
echo "== Criando Épicos Macro"

nova EPICO-01 "Épico: Infraestrutura como Código (CDK v2) & Deploy" "tipo: epico,frente: infra" "$ASSIGNEE" <<EOF
Épico agregador para a fundação de IaC em AWS CDK v2 puro em TypeScript.
EOF

nova EPICO-02 "Épico: Autenticação, Identidade e Borda Segura" "tipo: epico,frente: auth,frente: borda" "$ASSIGNEE" <<EOF
Épico agregador para Cognito User Pool fechado, S3 + CloudFront OAC e API Gateway REST com JWT.
EOF

nova EPICO-03 "Épico: Persistência e Lambdas de Negócio (DynamoDB & Tools)" "tipo: epico,frente: dados,frente: tools" "$ASSIGNEE" <<EOF
Épico agregador para as 3 Lambdas financeiras e tabelas DynamoDB com escritas condicionais atômicas.
EOF

nova EPICO-04 "Épico: Cérebro Agêntico no Bedrock AgentCore" "tipo: epico,frente: agente" "$ASSIGNEE" <<EOF
Épico agregador para a implantação do Strands Agent com Claude Haiku e AgentCore Gateway.
EOF

nova EPICO-05 "Épico: Validação, Evidências e Entrega Final" "tipo: epico,frente: docs" "$ASSIGNEE" <<EOF
Épico agregador para coleta das 5 evidências obrigatórias, documentação do README.md e Pull Request.
EOF

# =============================================================================
# 4. Tarefas Granulares
# =============================================================================
echo "== Criando Tarefas Granulares"

# --- ÉPICO 1: INFRA & DEPLOY ------------------------------------------------
nova INFRA-01 "Scaffolding do AWS CDK v2 puro em TypeScript" "frente: infra,tipo: feature,prioridade: alta" "$ASSIGNEE" EPICO-01 <<EOF
## Objetivo
Inicializar a estrutura do AWS CDK v2 na pasta \`Desafio-1/alvaro-santos/infra/\` com TypeScript, definindo padrões de governança, scripts e multi-stacks.

## Contexto & Regras Inegociáveis
- Requisito do edital: IaC dentro de \`infra/\` utilizando AWS CDK v2 em TypeScript.
- Prefixagem obrigatória: Todo recurso, stack e bucket deve conter o prefixo \`alvaro-\`.
- Região obrigatória: \`us-east-1\`.
- Isolamento total de pacotes: \`infra/\` possui seu próprio \`package.json\`, isolado do frontend.

## Critérios de Aceite
- [ ] Diretório \`infra/\` configurado com \`package.json\`, \`tsconfig.json\` e \`cdk.json\`.
- [ ] Dependências instaladas: \`aws-cdk-lib\`, \`constructs\`, \`typescript\`, \`ts-node\`, \`esbuild\`.
- [ ] Entrypoint \`bin/app.ts\` estruturado com convenção de nomes \`alvaro-<stack-name>\`.
- [ ] Comando \`npx cdk synth\` executa 100% offline e compila os templates CloudFormation em \`cdk.out/\` sem erros de tipo.

## Definition of Done (DoD)
Template CloudFormation sintetizado e validado localmente com sucesso.
EOF

nova INFRA-02 "Pipeline de Deploy em Comando Único e Teardown" "frente: infra,tipo: feature,prioridade: alta" "$ASSIGNEE" EPICO-01 <<EOF
## Objetivo
Criar e documentar um script de deploy em comando único que compila o frontend, executa o CDK deploy e invalida o cache do CloudFront, além de validar o comando de remoção completa (\`cdk destroy\`).

## Contexto & Regras Inegociáveis
- Edital página 5: *"Um único comando, documentado no seu README, deve criar o ambiente completo, incluindo o build e o upload do frontend e a invalidação do cache do CloudFront."*
- Teardown: Instruções claras para remover todos os recursos após a correção sem deixar sobras na conta.

## Critérios de Aceite
- [ ] Script \`npm run deploy\` (ou \`deploy.sh\`) documentado na pasta \`infra/\` ou raiz do aluno.
- [ ] O comando compila o frontend (\`npm --prefix frontend run build\`), gera os bundles e executa \`cdk deploy --all\`.
- [ ] Mecanismo de invalidação de cache do CloudFront integrado ao construto \`BucketDeployment\`.
- [ ] Processo de \`cdk destroy\` documentado com checklist de validação no console.

## Definition of Done (DoD)
Comando único testado e validado em ambiente local.
EOF

# --- ÉPICO 2: AUTH & BORDA --------------------------------------------------
nova AUTH-01 "Provisionamento do Amazon Cognito User Pool Fechado" "frente: auth,tipo: seguranca,prioridade: alta" "$ASSIGNEE" EPICO-02 <<EOF
## Objetivo
Provisionar o User Pool e App Client no Amazon Cognito com auto-cadastro desabilitado e suporte a autenticação por convite administrativo.

## Contexto & Regras Inegociáveis
- Edital página 3 e 6: Auto cadastro desabilitado (\`selfSignUpEnabled: false\` / \`AllowAdminCreateUserOnly: true\`).
- Usuários entram exclusivamente por convite (\`admin-create-user\`).
- Client configurado para SPA pública utilizando fluxo PKCE (sem client secret).
- Criação obrigatória de usuário para o instrutor antes da entrega.

## Critérios de Aceite
- [ ] Stack CDK \`alvaro-auth-stack\` provisionando \`Cognito.UserPool\`.
- [ ] \`selfSignUpEnabled: false\` e template de e-mail de convite configurado.
- [ ] \`UserPoolClient\` configurado sem segredo de cliente e com fluxos de autorização para SPA.
- [ ] Documentado comando/procedimento para criar usuário via CLI/Console para o avaliador.

## Definition of Done (DoD)
Stack sintetizada com as regras de fechamento e atributos de autenticação validados no CloudFormation.
EOF

nova EDGE-01 "Hospedagem Segura com Amazon S3 Privado + CloudFront (OAC)" "frente: borda,tipo: seguranca,prioridade: alta" "$ASSIGNEE" EPICO-02 <<EOF
## Objetivo
Configurar a infraestrutura de entrega da SPA utilizando bucket Amazon S3 totalmente privado distribuído globalmente pelo Amazon CloudFront com Origin Access Control (OAC).

## Contexto & Regras Inegociáveis
- Edital página 1, 5 e 6: Frontend publicado em S3 + CloudFront com URL pública e bucket privado.
- O bucket **não pode ser público** (\`blockPublicAccess: BLOCK_ALL\`) nem usar static website hosting do S3.
- Leitura restrita à distribuição via política de bucket condicionada ao CloudFront OAC (\`s3:GetObject\`).
- Tratamento de erro SPA: 403 e 404 devem responder \`index.html\` com HTTP 200.

## Critérios de Aceite
- [ ] Bucket S3 \`alvaro-frontend-bucket-<account>\` criado com bloqueio total de acesso público.
- [ ] Distribuição CloudFront com OAC associada ao bucket S3.
- [ ] Política de bucket concedendo permissão estrita apenas ao service principal \`cloudfront.amazonaws.com\` com condição \`AWS:SourceArn\` da distribuição.
- [ ] Error responses para roteamento client-side (SPA) configuradas.

## Definition of Done (DoD)
Template sintetizado e verificado quanto à ausência de permissões públicas no S3.
EOF

nova EDGE-02 "Amazon API Gateway REST com Streaming e JWT Authorizer" "frente: borda,tipo: feature,prioridade: alta" "$ASSIGNEE" EPICO-02 <<EOF
## Objetivo
Provisionar o Amazon API Gateway REST expondo o endpoint \`POST /chat\` com autorizador JWT do Cognito e suporte a streaming NDJSON (\`ResponseTransferMode: STREAM\`).

## Contexto & Regras Inegociáveis
- Edital página 1 e 6: Toda comunicação frontend/backend deve passar pelo API Gateway.
- Autorizador JWT do Cognito: Requisições sem token válido devem ser rejeitadas com \`401 Unauthorized\`.
- CORS: Permitir apenas a origem do CloudFront.
- Suporte a streaming contínuo via \`ResponseTransferMode: STREAM\` sem buffering prematuro.

## Critérios de Aceite
- [ ] API Gateway REST \`alvaro-chat-api\` provisionado no CDK.
- [ ] \`CognitoUserPoolsAuthorizer\` configurado no método \`POST /chat\`.
- [ ] Headers de CORS configurados nas respostas do Gateway (401, 403, 500) e métodos OPTIONS.
- [ ] Suporte a streaming contínuo ativado na integração da Lambda.

## Definition of Done (DoD)
API Gateway sintetizado com autorizador JWT e políticas de GatewayResponses para 401/CORS.
EOF

# --- ÉPICO 3: DADOS & TOOLS -------------------------------------------------
nova DATA-01 "Modelagem e Provisionamento das Tabelas DynamoDB" "frente: dados,tipo: feature,prioridade: alta" "$ASSIGNEE" EPICO-03 <<EOF
## Objetivo
Modelar e provisionar as 3 tabelas DynamoDB necessárias para o sistema de pagamentos agênticos, com billing on-demand e TTL.

## Contexto & Regras Inegociáveis
- Tabelas obrigatórias (com prefixo \`alvaro-\`):
  1. \`alvaro-usuarios\`: armazena saldo, limite e dados cadastrais.
  2. \`alvaro-intencoes\`: armazena intenções de pagamento com status e TTL.
  3. \`alvaro-conversas\`: armazena histórico da sessão de chat com TTL.
- Chaves primárias bem definidas e billing model \`PAY_PER_REQUEST\`.

## Critérios de Aceite
- [ ] Tabela \`alvaro-usuarios\` criada com Partition Key \`usuario_id\` (String).
- [ ] Tabela \`alvaro-intencoes\` criada com Partition Key \`intencao_id\` (String) e atributo TTL \`expires_at\`.
- [ ] Tabela \`alvaro-conversas\` criada com Partition Key \`session_id\` (String) e atributo TTL \`expires_at\`.
- [ ] Remoção segura configurada para ambiente de desenvolvimento (\`RemovalPolicy.DESTROY\`).

## Definition of Done (DoD)
Stack de dados sintetizada e documentada no README com esquema de chaves.
EOF

nova TOOL-01 "Lambda de Consulta de Catálogo e Saldo" "frente: tools,tipo: feature,prioridade: alta" "$ASSIGNEE" EPICO-03 <<EOF
## Objetivo
Implementar a função AWS Lambda para consulta de catálogo de produtos e verificação do saldo/limite atual do usuário autenticado.

## Contexto & Regras Inegociáveis
- O \`usuario_id\` deve ser fornecido via contexto autorizado pelo runtime.
- Menor privilégio: permissão estrita a \`dynamodb:GetItem\` na tabela \`alvaro-usuarios\`.
- Retorno estruturado amigável para consumo pela LLM/Agente.

## Critérios de Aceite
- [ ] Handler implementado em \`tools/consultar-saldo/\` (ou \`listar-catalogo\`).
- [ ] Leitura pontual de saldo no DynamoDB.
- [ ] Tratamento de usuário não encontrado com fallback gracioso.
- [ ] Role IAM associada sem acesso a tabelas de intenções ou Bedrock.

## Definition of Done (DoD)
Código da Lambda implementado, com grant de leitura no CDK e tipagem estrita.
EOF

nova TOOL-02 "Lambda de Registro de Intenção de Compra" "frente: tools,tipo: feature,prioridade: alta" "$ASSIGNEE" EPICO-03 <<EOF
## Objetivo
Implementar a função AWS Lambda para registrar formalmente a intenção de compra antes de qualquer pagamento.

## Contexto & Regras Inegociáveis
- Edital página 5: O valor da compra vem da intenção salva no banco, **nunca** de parâmetros preenchidos pela LLM.
- A intenção é salva com status \`PENDENTE\` e expiração de TTL (ex: 15 minutos).
- Retorna \`intencao_id\` único (UUID v4) para validação do usuário.

## Critérios de Aceite
- [ ] Handler implementado em \`tools/criar-intencao/\`.
- [ ] Gravação do item na tabela \`alvaro-intencoes\` com status \`PENDENTE\`, valor fixo do catálogo e timestamp de expiração.
- [ ] Retorno com resumo da compra e instruções para o agente solicitar confirmação.
- [ ] Permissão IAM restrita a \`dynamodb:PutItem\` na tabela \`alvaro-intencoes\`.

## Definition of Done (DoD)
Lambda implementada e integrada com testes unitários locais de geração de intenção.
EOF

nova TOOL-03 "Lambda de Execução de Compra com Escrita Condicional Atômica" "frente: tools,tipo: seguranca,prioridade: alta" "$ASSIGNEE" EPICO-03 <<EOF
## Objetivo
Implementar a função AWS Lambda de liquidação de pagamento (Cartão ou Pix), utilizando escritas condicionais no DynamoDB para garantir idempotência estrita.

## Contexto & Regras Inegociáveis
- Edital página 5: *"A atualização do limite e o pagamento da intenção não podem gerar duplicidade se a mesma chamada chegar duas vezes. Dica: escritas condicionais do DynamoDB."*
- Validações obrigatórias:
  1. \`intencao_id\` deve existir e estar com \`status = 'PENDENTE'\`.
  2. Saldo do usuário deve ser \`>= valor\` da intenção.
  3. Atualização de status para \`PAGO\` e débito do saldo de forma atômica (TransactWriteItems ou ConditionExpression).
  4. Rejeição imediata em caso de duplicidade ou saldo insuficiente.

## Critérios de Aceite
- [ ] Handler implementado em \`tools/confirmar-pagamento/\`.
- [ ] Escrita condicional com \`attribute_exists\` e verificação de status \`PENDENTE\`.
- [ ] Débito atômico do saldo com condição \`saldo >= :valor\`.
- [ ] Rejeição de requisições repetidas sem alterar saldo.
- [ ] Tratamento de \`ConditionalCheckFailedException\` com mensagem clara.

## Definition of Done (DoD)
Testes unitários cobrindo: sucesso, saldo insuficiente, intenção inválida e chamada duplicada.
EOF

# --- ÉPICO 4: AGENTE STRANDS & BEDROCK --------------------------------------
nova AGENT-01 "Configuração do Strands Agent no Bedrock AgentCore Runtime" "frente: agente,tipo: feature,prioridade: alta" "$ASSIGNEE" EPICO-04 <<EOF
## Objetivo
Configurar o agente inteligente utilizando o framework Strands e implantá-lo no Bedrock AgentCore Runtime com o modelo Claude Haiku.

## Contexto & Regras Inegociáveis
- Modelo: Claude Haiku (us-east-1 inference profile ou ARN oficial).
- Prompt de sistema rigoroso:
  - Orientar o fluxo de compras em etapas sequenciais (catálogo -> intenção -> confirmação).
  - Nunca inventar valores nem alterar o montante da intenção registrada.
  - Solicitar confirmação explícita do método de pagamento (Cartão ou Pix).
- Role do AgentCore Runtime: Menor privilégio (invocar Bedrock, chamar Lambdas de tools e CloudWatch Logs; **sem** acesso direto ao DynamoDB).

## Critérios de Aceite
- [ ] Configuração do agente em \`agent/\` com Strands e prompt de sistema em português.
- [ ] Role IAM associada ao runtime com menor privilégio configurada no CDK.
- [ ] Tratamento de respostas de ferramentas em linguagem natural fluida.

## Definition of Done (DoD)
Agente configurado e sintetizado na stack CDK com permissões mínimas.
EOF

nova AGENT-02 "Integração do AgentCore Gateway com as Lambdas de Tools" "frente: agente,tipo: feature,prioridade: alta" "$ASSIGNEE" EPICO-04 <<EOF
## Objetivo
Conectar as 3 funções Lambda de ferramentas ao Bedrock AgentCore Runtime via AgentCore Gateway (protocolo MCP/Lambda).

## Contexto & Regras Inegociáveis
- Mapeamento das 3 tools: \`listar_catalogo\`, \`registrar_intencao\`, \`realizar_compra\`.
- Schemas de parâmetros estritos com validação de tipos.
- Falhas de ferramentas devem ser traduzidas pelo agente em mensagens amigáveis, nunca vazando stack traces.

## Critérios de Aceite
- [ ] Schemas JSON das ferramentas definidos e associados ao runtime.
- [ ] Conexão entre o AgentCore e as 3 Lambdas via CDK com permissão de invocação.
- [ ] Mensagens de erro de saldo ou validação tratadas educadamente para o usuário.

## Definition of Done (DoD)
Contrato de ferramentas validado e sintetizado no CDK.
EOF

nova API-01 "Lambda do Chat de Streaming NDJSON (Borda da API)" "frente: borda,frente: agente,tipo: feature,prioridade: alta" "$ASSIGNEE" EPICO-04 <<EOF
## Objetivo
Implementar a função AWS Lambda acoplada ao API Gateway para receber as mensagens do usuário, extrair o \`usuario_id\` do token JWT, orquestrar o AgentCore e fazer streaming contínuo da resposta em NDJSON.

## Contexto & Regras Inegociáveis
- Edital página 3: O \`usuario_id\` deve ser extraído **obrigatoriamente da claim \`sub\`** do token Cognito (\`event.requestContext.authorizer.claims.sub\`).
- É proibido ler \`usuario_id\` do corpo da requisição ou permitir injeção pelo cliente.
- Resposta transmitida em streaming contínuo (NDJSON) compatível com o cliente React existente.
- Menor privilégio: Permissão apenas para invocar o AgentCore Runtime e gravar na tabela de conversas.

## Critérios de Aceite
- [ ] Handler em \`api/\` extraindo identidade segura do JWT.
- [ ] Invocação do Bedrock AgentCore Runtime com streaming de tokens.
- [ ] Emissão de eventos estruturados em NDJSON (\`token\`, \`tool_start\`, \`tool_end\`, \`done\`).
- [ ] Persistência do histórico na tabela \`alvaro-conversas\`.

## Definition of Done (DoD)
Lambda implementada e validada contra o contrato de streaming do frontend.
EOF

# --- ÉPICO 5: VALIDAÇÃO & EVIDÊNCIAS ---------------------------------------
nova DOCS-01 "Coleta e Estruturação das 5 Evidências Obrigatórias" "frente: docs,tipo: feature,prioridade: alta" "$ASSIGNEE" EPICO-05 <<EOF
## Objetivo
Executar os cenários de teste na nuvem da AWS e capturar as 5 evidências visuais (prints ou vídeo curto) exigidas expressamente pelo edital.

## Contexto & Regras Inegociáveis
- Edital página 6: As seguintes evidências são obrigatórias na entrega:
  1. Login funcionando no Cognito.
  2. Chamada à API sem token sendo rejeitada com \`401 Unauthorized\` (curl ou Postman).
  3. Compra bem-sucedida com cartão e com Pix.
  4. Tentativa de compra bloqueada por limite excedido.
  5. Tentativa com \`intencao_id\` inválido sendo recusada.

## Critérios de Aceite
- [ ] Captura de tela da autenticação no Cognito (tela de login e redirecionamento).
- [ ] Print do terminal com comando \`curl\` contra o API Gateway retornando status 401.
- [ ] Prints da interface do chat comprovando compras finalizadas (Cartão e Pix).
- [ ] Print comprovando recusa por saldo insuficiente.
- [ ] Print comprovando recusa de intenção adulterada ou inexistente.
- [ ] Imagens organizadas na pasta \`docs/screenshots/\` com referências relativas no README.

## Definition of Done (DoD)
Todas as 5 evidências coletadas, validadas e anexadas à documentação.
EOF

nova DOCS-02 "Redação do README.md e Abertura do Pull Request" "frente: docs,tipo: feature,prioridade: alta" "$ASSIGNEE" EPICO-05 <<EOF
## Objetivo
Consolidar a documentação final no \`Desafio-1/alvaro-santos/README.md\`, auditar o histórico do Git contra vazamento de credenciais e abrir o Pull Request oficial para o repositório da Compass.

## Contexto & Regras Inegociáveis
- Edital página 6: O \`README.md\` deve conter:
  1. Diagrama da arquitetura implementada.
  2. Instruções de deploy passo a passo (pré-requisitos e comando IaC).
  3. Modelo do Bedrock usado e justificativa.
  4. Modelagem do DynamoDB (tabelas, chaves e atributos).
  5. Resumo das permissões IAM de cada role (menor privilégio).
  6. Seção com as 5 evidências visuais.
  7. Instruções para remover todos os recursos criados (\`cdk destroy\`).
- Auditoria de segurança: Zero chaves, segredos ou tokens no código ou histórico.
- Usuário do avaliador criado no Cognito antes do envio.

## Critérios de Aceite
- [ ] \`README.md\` preenchido com todos os 7 tópicos do edital.
- [ ] Histórico de commits auditado (\`git log\` limpo sem segredos).
- [ ] Usuário do instrutor criado no User Pool.
- [ ] Pull Request aberto da branch \`fellow/alvaro-santos-desafio-1\` para a \`main\` do upstream.

## Definition of Done (DoD)
Pull Request oficial submetido e validado contra todos os critérios de conclusão do edital.
EOF

# =============================================================================
# 5. Atualização dos Épicos com as Tarefas Filhas
# =============================================================================
echo "== Vinculando Tarefas aos seus Épicos"

for epico in EPICO-01 EPICO-02 EPICO-03 EPICO-04 EPICO-05; do
  filhos="${FILHOS[$epico]:-}"
  corpo_filhos="### Tarefas Integrantes deste Épico:"$'\n\n'
  for f in $filhos; do
    corpo_filhos+="- [ ] #${NUM[$f]} **[$f]** ${TITULO[$f]}"$'\n'
  done

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] Atualizando épico #${NUM[$epico]} com tarefas:$filhos"
  else
    gh issue edit "${NUM[$epico]}" --repo "$REPO" --body "$corpo_filhos" >/dev/null
    echo "Épico #${NUM[$epico]} atualizado."
  fi
done

echo "== Concluído com sucesso! Backlog do Desafio 1 criado no repositório $REPO."
