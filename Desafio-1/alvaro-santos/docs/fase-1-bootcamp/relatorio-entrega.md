# Relatório completo das alterações

## Chatbot com Tools MCP de Pagamentos

**Data da consolidação:** 30/08/2026  
**Ambiente validado:** Windows, Node.js 22.15, npm 10.9, Ollama 0.33.2  
**Modelo local:** `qwen3:1.7b`  
**Diretório do Ollama:** `C:\Users\kauan\AppData\Local\Programs\Ollama`  
**Escopo:** frontend React/Vite, backend Express, agente Ollama e servidor MCP de pagamentos.

---

## 1. Objetivo do trabalho

O objetivo foi transformar os três módulos já existentes em uma aplicação local realmente integrada e aderente ao desafio de pagamentos agênticos:

```text
Frontend React/Vite :5173
          |
          | JWT + HTTP/NDJSON + conversation_id
          v
Backend Express :3000
          |                       |
          | Ollama /api/chat      | MCP Streamable HTTP
          v                       v
Ollama :11434               MCP Payments :3001
qwen3:1.7b                  catálogo, intenção e compra
```

O trabalho não se limitou a fazer o frontend alcançar uma rota HTTP. Também foi necessário garantir que:

- o usuário autenticado fosse propagado até o MCP;
- uma intenção só pudesse ser paga pelo usuário e pela conversa que a criou;
- o navegador não pudesse forjar histórico de tools;
- limite, estoque, preço e status fossem definidos apenas pelo servidor;
- PIX e cartão funcionassem;
- IDs inventados, expirados, reutilizados ou pertencentes a outra sessão fossem recusados;
- o histórico completo e confiável chegasse ao agente nos turnos seguintes;
- o Ollama real funcionasse com o modelo local instalado;
- os fluxos fossem comprovados por testes automatizados e capturas reais do frontend.

---

## 2. Resumo executivo do resultado

Ao final do trabalho, a aplicação passou a ter:

- frontend usando o backend real por padrão;
- autenticação JWT obrigatória no chat;
- consulta do limite atual diretamente no domínio de pagamentos;
- transporte MCP protegido por segredo compartilhado;
- identidade de usuário e conversa propagada em cada requisição MCP;
- intenções vinculadas obrigatoriamente a `user_id` e `conversation_id`;
- histórico autoritativo mantido no backend;
- bloqueio de requisições concorrentes na mesma conversa;
- descoberta em runtime das três tools MCP;
- fallback determinístico quando o modelo local deixa de emitir uma `tool_call` obrigatória;
- mensagens financeiras construídas com os dados reais retornados pelas tools;
- streaming NDJSON compatível com o frontend e protegido contra ociosidade prolongada;
- compra aprovada por PIX;
- compra aprovada por cartão;
- bloqueio por `LIMITE_EXCEDIDO`;
- bloqueio por `INTENCAO_INVALIDA`;
- testes de integração Backend → MCP com um simulador determinístico do protocolo HTTP do Ollama;
- 36 testes do frontend aprovados;
- builds e lint aprovados;
- quatro screenshots reais adicionadas à entrega.

---

## 3. Problemas encontrados

### 3.1 Frontend configurado para mocks por padrão

**Situação encontrada**

`VITE_USE_MOCKS` assumia `true` quando a variável não existia, e o `.env.example` também indicava `true`.

**Impacto**

Mesmo com backend, MCP e Ollama iniciados, a interface podia continuar respondendo com dados simulados. Isso escondia falhas reais de integração e não comprovava o fluxo exigido pelo desafio.

**Correção**

- O padrão de `VITE_USE_MOCKS` foi alterado para `false`.
- O `.env.example` e a documentação foram atualizados.
- O modo mock foi mantido somente como opção explícita de demonstração isolada.

### 3.2 Frontend não enviava um identificador de conversa

**Situação encontrada**

O corpo de `POST /api/chat` continha somente `messages`.

**Impacto**

O backend e o MCP não conseguiam diferenciar de forma segura duas conversas do mesmo usuário. Isso impedia o requisito de validar se uma intenção realmente apareceu na sessão atual.

**Correção**

- Foi incluído `conversation_id` no contrato do chat.
- O frontend gera e mantém um ID por conversa.
- Ao limpar/iniciar uma nova conversa, um novo ID é gerado.
- Os testes HTTP foram atualizados para conferir o body exato.

### 3.3 Backend confiava no histórico enviado pelo navegador

**Situação encontrada**

O backend encaminhava ao agente todo o array `messages` recebido do cliente, inclusive mensagens com papéis `assistant`, `system` e `tool`.

**Impacto de segurança**

Um cliente alterado poderia enviar uma falsa mensagem de tool dizendo que uma intenção havia sido criada, ou tentar injetar um novo system prompt. Isso violava o princípio de que o backend deve ser a fonte da verdade.

**Correção**

- Foi criado um armazenamento autoritativo de conversas no backend.
- O backend aceita o request, mas aproveita somente a mensagem de usuário mais recente e válida.
- O histórico efetivo é reconstruído a partir do armazenamento interno.
- Mensagens de sistema enviadas pelo cliente não são confiadas.
- Chamadas e resultados de tool passam a ser salvos pelo próprio backend.
- O histórico é isolado pela chave `userId:conversationId`.
- O armazenamento mantém no máximo 100 mensagens por conversa.

### 3.4 Intenções não eram obrigatoriamente vinculadas ao usuário

**Situação encontrada**

`user_id` era opcional na intenção e `registrar_intencao` aceitava um `userId` opcional.

**Impacto de segurança**

Podiam existir intenções sem proprietário definido, impossibilitando uma validação rigorosa na compra.

**Correção**

- `user_id` passou a ser obrigatório.
- `conversation_id` também passou a ser obrigatório.
- A função de registro agora exige um `ToolContext` confiável.
- Os campos internos de identidade não são devolvidos na resposta pública da tool.

### 3.5 Existia fallback silencioso para um usuário padrão

**Situação encontrada**

Quando não havia usuário associado, `realizar_compra` utilizava:

```ts
userId || intent.user_id || "usr_std_02"
```

**Impacto crítico**

Uma compra sem contexto autenticado poderia cair na conta do usuário padrão. Esse comportamento é incompatível com uma operação de pagamentos.

**Correção**

- O fallback foi removido completamente.
- `realizar_compra` exige `ToolContext` com usuário e conversa.
- Ausência ou divergência do contexto causa recusa.

### 3.6 Intenção não era isolada por conversa

**Situação encontrada**

A validação existente considerava, quando disponível, apenas o usuário.

**Impacto de segurança**

Uma intenção legítima criada em outra conversa do mesmo usuário poderia ser reutilizada fora da sessão em que apareceu.

**Correção**

A compra exige simultaneamente:

```text
intent.user_id === context.userId
intent.conversation_id === context.conversationId
```

Qualquer divergência retorna `INTENCAO_INVALIDA`.

### 3.7 Endpoint MCP não possuía autenticação interna

**Situação encontrada**

Qualquer cliente local capaz de alcançar `POST /mcp` podia tentar descobrir e executar tools.

**Impacto**

O MCP não conseguia distinguir o backend autorizado de outro processo local.

**Correção**

- Foi criado `MCP_SHARED_SECRET`.
- Backend envia `x-mcp-secret` em cada conexão.
- MCP recusa chamadas sem o segredo correto com HTTP 401.
- O segredo fica somente no backend e no MCP; não é exposto ao Vite.

### 3.8 Identidade autenticada não chegava ao MCP

**Situação encontrada**

O cliente MCP não enviava contexto de usuário ou conversa.

**Impacto**

As tools não tinham informação confiável para aplicar isolamento e limite ao usuário autenticado.

**Correção**

O backend passou a enviar os headers internos:

```text
x-mcp-secret
x-user-id
x-conversation-id
```

Esses valores são definidos a partir do JWT validado e do histórico autoritativo, não a partir de argumentos livres de tool.

### 3.9 Perfil retornado pelo backend podia mostrar limite desatualizado

**Situação encontrada**

Login e `/api/user/me` devolviam o perfil mantido no módulo local de autenticação. O débito, entretanto, acontecia no armazenamento do MCP.

**Impacto funcional**

Depois de uma compra, o comprovante podia mostrar um limite e o cabeçalho do frontend continuar mostrando outro.

**Correção**

- O MCP ganhou `GET /internal/users/:id` protegido pelo segredo interno.
- Login continua validando credenciais no backend, mas devolve o limite atual consultado no MCP.
- `/api/user/me` também consulta o MCP.
- Após uma compra aprovada, o frontend chama novamente o perfil e atualiza o cabeçalho.

### 3.10 Contrato de erro divergente entre frontend e MCP

**Situação encontrada**

O MCP seguia o desafio e retornava `erro`, enquanto tipos, mocks, guards e card do frontend esperavam `codigo`.

**Impacto funcional**

Uma recusa real podia não ser reconhecida como `PurchaseRejectedResult`, impedindo o card especializado de aparecer corretamente.

**Correção**

Todo o frontend foi alinhado ao contrato:

```ts
{
  status: "recusado";
  erro: string;
  mensagem: string;
}
```

Mocks, testes, type guards e componente visual foram atualizados em conjunto.

### 3.11 Reutilização de uma única instância MCP entre transportes

**Situação encontrada**

O servidor criava uma única instância global de `McpServer` e chamava `connect` em transportes criados a cada request.

**Risco**

Essa combinação dificulta isolar contexto por request e pode gerar comportamento incorreto quando existem conexões concorrentes.

**Correção**

- Uma nova instância MCP stateless é criada por requisição HTTP.
- O contexto confiável daquela requisição é fechado dentro dos handlers das tools.
- O estado de negócio continua nos stores em memória compartilhados.
- O transporte é fechado quando a resposta/conexão termina.

### 3.12 Requisições concorrentes na mesma conversa

**Situação encontrada**

Não havia trava por conversa.

**Impacto**

Duas mensagens simultâneas podiam ler o mesmo histórico, executar ações fora de ordem ou salvar uma versão sobre a outra.

**Correção**

- Foi criado um conjunto de conversas ativas.
- A chave usada é `userId:conversationId`.
- Uma segunda requisição simultânea recebe HTTP 409.
- A trava é sempre removida no bloco `finally`.

### 3.13 Modelo local não chamava as tools de forma consistente

**Erro observado no teste real**

Com `qwen3:1.7b`, a frase “O que vocês têm à venda?” inicialmente recebeu uma resposta inventada sobre categorias, sem `listar_catalogo`. Nos turnos seguintes, o modelo também pediu informações desnecessárias em vez de executar `registrar_intencao` e `realizar_compra`.

**Impacto**

Os testes com Ollama simulado passavam, mas o roteiro obrigatório falhava com o modelo real.

**Correção**

Foi adicionada uma camada de fallback no agente:

- primeiro o Ollama recebe as tools descobertas pelo MCP e tem oportunidade de emitir `tool_calls`;
- se não emitir uma tool e a última mensagem contiver uma ação obrigatória inequívoca, o backend infere somente a tool necessária;
- catálogo aciona `listar_catalogo`;
- pedido com número do produto aciona `registrar_intencao`;
- confirmação PIX/cartão usa a intenção válida mais recente do histórico;
- um ID explicitamente inventado continua sendo testado e recusado.

Essa camada não calcula preço, não aprova compra e não altera limite. Ela apenas garante que o domínio correto seja consultado; todas as decisões financeiras continuam no MCP.

### 3.14 Raciocínio do modelo causava longos períodos sem dados

**Erro observado no teste real**

Na primeira chamada real, o modelo permaneceu processando por mais de 30 segundos antes de produzir conteúdo. O parser do frontend possui proteção contra streams ociosos.

**Impacto**

Mesmo com a API funcionando, o navegador poderia interpretar o silêncio como timeout.

**Correção**

- Foi enviado `think: false` ao Ollama para o fluxo transacional.
- Foi adicionado suporte a eventos internos de heartbeat durante chunks de raciocínio.
- O tempo real caiu de aproximadamente 115 segundos na primeira execução fria para cerca de 1 a 10 segundos nos fluxos aquecidos testados.

### 3.15 Modelo inventava detalhes ao explicar o retorno da tool

**Erro observado no navegador**

Após uma intenção correta, o card mostrava a expiração retornada pelo MCP, mas o texto livre do modelo afirmou que a compra seria realizada “após 30 dias”. Esse dado não existia no resultado da tool.

**Impacto**

Mesmo com o backend seguro, a explicação ao usuário podia conter informação financeira ou temporal incorreta.

**Correção**

- Respostas de catálogo, intenção, aprovação e recusa passaram a ser formatadas a partir do objeto retornado pela tool.
- Preço, quantidade, expiração, transação, método e limite restante não são reinterpretados pelo modelo.
- O frontend continua recebendo uma mensagem natural, mas ela é grounded nos dados do MCP.

### 3.16 Validação de estoque somente no registro

**Situação encontrada**

O estoque era consultado ao registrar a intenção, mas não era revalidado imediatamente antes da compra.

**Impacto**

Entre intenção e pagamento, outra operação poderia consumir o estoque.

**Correção**

`realizar_compra` volta a consultar o produto e o estoque antes de debitar o limite e concluir a transação.

### 3.17 Método inválido era barrado antes de produzir o erro do contrato

**Situação encontrada**

O schema MCP utilizava `z.enum(["cartao", "pix"])`. Isso é seguro, mas uma entrada como `boleto` podia terminar como erro de validação do protocolo em vez do retorno de negócio `METODO_INVALIDO` exigido no contrato.

**Correção**

- O schema aceita string.
- A função de negócio valida os dois valores permitidos.
- Um método diferente retorna de forma controlada:

```json
{
  "status": "recusado",
  "erro": "METODO_INVALIDO",
  "mensagem": "Método de pagamento inválido..."
}
```

### 3.18 CORS e tamanho de body permissivos

**Situação encontrada**

O backend usava CORS sem uma lista explícita de origens e `express.json()` sem limite específico do projeto.

**Correção**

- Backend permite apenas as origens configuradas em `FRONTEND_ORIGINS`.
- `localhost:5173` e `127.0.0.1:5173` estão previstos no exemplo local.
- Bodies JSON foram limitados a 256 KiB.
- O host de bind passou a ser configurável e usa `127.0.0.1` no ambiente preparado.

### 3.19 Cobertura automatizada não exercitava a arquitetura completa

**Situação encontrada**

Havia testes isolados, mas não um teste que subisse MCP real, API real e verificasse o protocolo de agente ponta a ponta.

**Correção**

Foi criado `backend/src/tests/integration.test.ts`, que:

- abre um MCP real em porta dinâmica;
- abre o backend real em porta dinâmica;
- abre um simulador HTTP determinístico do endpoint `/api/chat` do Ollama;
- verifica autenticação obrigatória;
- verifica descoberta e execução das três tools;
- aprova PIX e cartão;
- verifica atualização do limite;
- verifica `LIMITE_EXCEDIDO`;
- verifica intenção de outra conversa;
- confirma que resultados de tool chegam ao modelo no histórico posterior.

### 3.20 Entrega não continha as quatro evidências finais reais

**Situação encontrada**

A documentação ainda orientava capturar as telas futuramente e o relatório antigo dizia que backend, MCP e Ollama reais não haviam sido executados.

**Correção**

- Os quatro fluxos foram executados no frontend real.
- Foram salvas capturas versionáveis em `frontend/docs/screenshots/`.
- O README raiz passou a exibir as evidências.
- `frontend/docs/VALIDACAO.md` foi corrigido para refletir a validação real.

---

## 4. Arquitetura e fluxo final

### 4.1 Login

1. Frontend envia usuário e senha para `POST /api/auth/login`.
2. Backend verifica a senha protegida por `scrypt`.
3. Backend gera JWT com ID, username e nome.
4. Backend consulta o perfil financeiro atual no MCP usando o segredo interno.
5. Frontend recebe token, expiração e limite atual.

### 4.2 Chat e histórico

1. Frontend envia `conversation_id`, mensagens visuais e Bearer JWT.
2. Middleware valida o JWT.
3. Backend seleciona somente a última mensagem de usuário válida.
4. Backend carrega seu próprio histórico pela chave usuário + conversa.
5. A nova mensagem é anexada ao histórico confiável.
6. Agente recebe system prompt, histórico completo, chamadas e resultados anteriores.
7. Histórico concluído é salvo novamente pelo backend.

### 4.3 Descoberta e execução de tools

1. Backend abre um cliente MCP com segredo, usuário e conversa.
2. Cliente chama `listTools()`.
3. Schemas MCP são convertidos para o formato de tools do Ollama.
4. Ollama recebe histórico e tools.
5. Tool escolhida pelo modelo, ou pelo fallback estrito quando necessário, é executada no MCP.
6. Resultado é salvo como mensagem `tool` e enviado ao frontend via NDJSON.

### 4.4 Compra

1. `registrar_intencao` localiza o produto no catálogo.
2. MCP valida quantidade e estoque.
3. MCP calcula `valor_total`; o cliente nunca envia o valor.
4. MCP gera `intencao_id` e associa usuário + conversa.
5. `realizar_compra` exige o ID recebido.
6. MCP verifica propriedade, conversa, status, expiração, método, estoque e limite.
7. Somente após todas as validações o limite e o estoque são debitados.
8. A intenção recebe status `paga`.
9. MCP gera `transacao_id` e devolve o limite restante.

### 4.5 Barreiras contra fraude e prompt injection

- O frontend não informa preço.
- O modelo não informa usuário autenticado.
- O modelo não informa saldo ou limite.
- O cliente não consegue inserir resultados de tool no histórico confiável.
- O backend verifica se o ID apareceu em `registrar_intencao` na conversa.
- O MCP repete a validação de usuário e conversa em seu próprio store.
- IDs de outra conversa ou usuário são indistinguíveis de IDs inválidos para o solicitante.
- Pedidos para ignorar limite não alteram a regra do servidor.
- Reutilização de intenção retorna `INTENCAO_JA_PAGA`.

---

## 5. Alterações detalhadas por módulo e arquivo

## 5.1 Raiz do projeto

### `README.md`

- Reescrito para documentar a arquitetura real.
- Adicionada lista dos requisitos cumpridos.
- Documentados Node, npm, Ollama e `qwen3:1.7b`.
- Adicionados comandos de instalação com `npm ci`.
- Documentadas as quatro etapas de execução local.
- Adicionada tabela dos três usuários de demonstração.
- Adicionado roteiro manual do desafio.
- Adicionados todos os comandos de teste e build.
- Documentadas rotas HTTP e proteções.
- Explicado o uso de `conversation_id` e histórico autoritativo.
- Adicionadas as quatro imagens da execução real.
- Documentada a camada determinística para modelos locais pequenos.

### `RELATORIO_COMPLETO_DAS_ALTERACOES.md`

- Novo documento criado para consolidar diagnóstico, mudanças, decisões, testes e evidências.

## 5.2 Backend

### `backend/.env.example`

- Adicionado `MCP_SHARED_SECRET`.
- Adicionado `FRONTEND_ORIGINS`.
- Mantidas as configurações de Ollama, JWT, host e porta.

### `backend/README.md`

- Documentado o segredo compartilhado.
- Documentadas as origens CORS.
- Adicionado `conversation_id` no contrato de chat.
- Explicado que o histórico efetivo é mantido pelo backend.

### `backend/package.json`

- Scripts `dev`, `start` e testes usam `dotenvx --ignore=MISSING_ENV_FILE`.
- Adicionado `test:integration`.
- `npm test` agora executa autenticação e integração completa.

### `backend/src/auth/jwt.ts`

- Removida a importação global e duplicada de configuração do dotenv.
- Variáveis são carregadas pela camada de execução definida nos scripts.

### `backend/src/llm/conversationStore.ts` — novo

- Store em memória por usuário e conversa.
- Cópia defensiva com `structuredClone`.
- Remoção de mensagens system antes de persistir.
- Limite de 100 mensagens por conversa.
- Função de reset para testes.

### `backend/src/llm/prompts.ts`

- Corrigidos erros de escrita nas regras das tools.
- Tornado explícito que `registrar_intencao` recebe produto e quantidade.
- Adicionada regra contra intenção inventada, troca de usuário e bypass de limite.

### `backend/src/llm/agentService.ts`

Este foi o arquivo com a maior alteração. Foram adicionados:

- suporte a `McpContext`;
- retorno do histórico concluído;
- campos `thinking` e `tool_name` nas mensagens internas;
- descoberta obrigatória das tools antes da chamada ao Ollama;
- erro explícito quando o MCP está indisponível;
- system prompt controlado pelo backend;
- `think: false` para reduzir latência;
- parser robusto dos chunks NDJSON do Ollama;
- heartbeat periódico para raciocínio silencioso;
- coleta segura de `tool_calls`;
- verificação dos IDs de intenção presentes no histórico confiável;
- recusa local de tentativa de pagar ID que não apareceu na conversa;
- fallback de tool para catálogo, intenção e pagamento quando o modelo não chama a tool;
- suporte a número como “produto 3” ou “item 3”, convertido para `prod_003`;
- suporte a quantidade explícita em unidades;
- seleção da intenção válida mais recente no pagamento;
- emissão de evento de início de tool e evento com resultado;
- mensagens naturais geradas diretamente dos dados da tool;
- formatação monetária `pt-BR`;
- fechamento do cliente MCP em `finally`;
- limite seguro de rodadas do agente;
- mensagens de erro uniformes.

### `backend/src/mcp/client.ts`

- Criado tipo `McpContext`.
- Conexão MCP agora exige usuário e conversa.
- Adicionados headers internos de autenticação e contexto.
- Adicionada consulta protegida de perfil em `/internal/users/:id`.
- Adicionado type guard do perfil retornado pelo MCP.
- Mantida conversão dos schemas MCP para tools Ollama.
- Mantido tratamento seguro de respostas textuais ou JSON.

### `backend/src/routes/authRoutes.ts`

- Login tornou-se assíncrono.
- Credenciais continuam validadas no backend.
- Perfil financeiro é consultado no MCP antes de responder.
- Falha do MCP no login retorna HTTP 503 com mensagem clara.
- `/api/user/me` devolve o limite atual do MCP.
- Falha de consulta do limite retorna HTTP 503.

### `backend/src/routes/chatRoutes.ts`

- Schema passou a exigir `conversation_id` de 8 a 100 caracteres.
- Adicionados limites de quantidade e tamanho de mensagens.
- Seleção somente da última mensagem de usuário válida.
- Carregamento do histórico autoritativo.
- Contexto autenticado encaminhado ao agente e ao MCP.
- Trava de concorrência por usuário e conversa.
- Persistência do histórico após cada turno.
- Abort do agente quando o cliente encerra a conexão.
- Streaming NDJSON mantido com `no-cache`.

### `backend/src/server.ts`

- Aplicação Express exportada para testes de integração.
- Servidor só chama `listen` quando executado como processo principal.
- Host e porta configuráveis.
- CORS restrito a `FRONTEND_ORIGINS`.
- Limite de 256 KiB no JSON.
- Healthcheck enriquecido com serviço, uptime e timestamp.

### `backend/src/tests/auth.test.ts`

- Removida importação dotenv duplicada.
- Mantidos testes de hashing, login, JWT e limites.

### `backend/src/tests/mcp.test.ts`

- Cliente MCP de teste agora envia usuário e conversa.
- Adequado ao novo contrato seguro do cliente.

### `backend/src/tests/integration.test.ts` — novo

- Teste ponta a ponta entre backend real e MCP real.
- Simulador local do endpoint Ollama.
- Portas dinâmicas para reduzir colisão.
- Testes de 401 no chat.
- Testes das três tools.
- PIX, cartão, atualização de limite e bloqueios.
- Verificação de histórico completo no request enviado ao modelo.

## 5.3 Frontend

### `frontend/.env.example`

- `VITE_USE_MOCKS=false` passou a ser o padrão de entrega.

### `frontend/README.md`

- Documentado que a integração real é o padrão.
- Mocks descritos apenas como modo opcional.
- Orientação de reiniciar o Vite ao alterar variáveis.

### `frontend/docs/VALIDACAO.md`

- Data e ambiente atualizados.
- Corrigida a quantidade real de produtos do catálogo.
- Removidos IDs estáticos de transações mock das conclusões reais.
- Atualizado o cenário de limite para produto 6.
- Adicionada seção da integração real.
- Removida a afirmação antiga de que backend/MCP/Ollama não haviam sido executados.
- Adicionadas limitações reais: simulação local e memória volátil.
- Adicionados links para as quatro capturas atuais.

### `frontend/src/config/env.ts`

- Fallback de `VITE_USE_MOCKS` alterado de `true` para `false`.
- Validação estrita de `true` ou `false` mantida.

### `frontend/src/types/chat.ts`

- `SendChatOptions` ganhou `conversationId`.

### `frontend/src/services/chatService.ts`

- Serviço recebe `conversationId`.
- Body real agora envia `conversation_id` e `messages`.
- Bearer JWT, NDJSON e timeout geral de 180 segundos mantidos.
- Continua sem fallback silencioso para mock em falhas de rede.

### `frontend/src/hooks/useChat.ts`

- Criada referência estável para o ID da conversa.
- ID é enviado em todos os turnos daquela conversa.
- Limpeza do chat cria um novo ID.
- Atualização de perfil após compra aprovada mantida.

### `frontend/src/types/tools.ts`

- Campo de recusa alterado de `codigo` para `erro`.

### `frontend/src/utils/guards.ts`

- Type guard de recusa atualizado para exigir `erro` e `mensagem`.

### `frontend/src/components/tools/PurchaseErrorCard.tsx`

- Card passou a renderizar `result.erro`.

### `frontend/src/mocks/mockToolEvents.ts`

- Todas as cinco recusas mock foram alinhadas ao campo `erro`.

### `frontend/src/mocks/mockChat.test.ts`

- Expectativas de intenção inválida, expirada, já paga, limite excedido e método inválido foram atualizadas para o contrato real.

### `frontend/src/services/chatService.test.ts`

- Adicionado `conversationId` à fixture.
- Teste confere que `conversation_id` é enviado no JSON.

### `frontend/docs/screenshots/compra-pix-aprovada.png` — novo

- Evidência real de pagamento PIX aprovado e limite atualizado.

### `frontend/docs/screenshots/compra-cartao-aprovada.png` — novo

- Evidência real de pagamento com cartão aprovado.

### `frontend/docs/screenshots/limite-excedido.png` — novo

- Evidência real do retorno `LIMITE_EXCEDIDO`.

### `frontend/docs/screenshots/intencao-invalida.png` — novo

- Evidência real de `int_falsa_123` recusada como `INTENCAO_INVALIDA`.

## 5.4 Servidor MCP

### `mcp-tools/.env.example`

- Adicionado `MCP_SHARED_SECRET`.

### `mcp-tools/README.md`

- Documentado o segredo compartilhado.
- Documentado o vínculo de intenção com usuário e conversa.
- Documentada a consulta interna de perfil.

### `mcp-tools/package.json`

- Scripts usam `dotenvx --ignore=MISSING_ENV_FILE`.
- Mantidos build e teste de tools.

### `mcp-tools/src/types.ts`

- `Intent.user_id` deixou de ser opcional.
- Adicionado `Intent.conversation_id` obrigatório.
- Criado `PublicIntent`, sem campos internos.
- Criado `ToolContext`.
- Removido campo de senha do tipo de usuário financeiro.

### `mcp-tools/src/db/intents.ts`

- Registro exige usuário e conversa.
- Store mantém os dois vínculos junto da intenção.
- Expiração e moeda continuam configuráveis.

### `mcp-tools/src/db/users.ts`

- Senhas em texto simples foram removidas do domínio financeiro.
- O MCP mantém somente identidade pública e limites.
- Autenticação e armazenamento financeiro permanecem separados.

### `mcp-tools/src/db/catalog.ts`

- Removida importação dotenv duplicada.
- Catálogo e estoque em memória mantidos.

### `mcp-tools/src/tools/registerIntent.ts`

- Função exige `ToolContext`.
- Intenção recebe usuário e conversa autenticados.
- Valor continua calculado pelo preço do catálogo.
- Estoque é validado.
- Resposta pública omite `user_id`, `conversation_id` e `created_at`.

### `mcp-tools/src/tools/executePurchase.ts`

- Função exige `ToolContext`.
- Removido fallback para usuário padrão.
- Propriedade passa a validar usuário e conversa.
- Método inválido retorna erro de negócio controlado.
- Estoque é revalidado antes da aprovação.
- Limite é consultado e debitado exclusivamente do usuário autenticado.
- Estoque e status só são alterados depois das validações.
- Mantidos os retornos `INTENCAO_INVALIDA`, `INTENCAO_EXPIRADA`, `INTENCAO_JA_PAGA`, `LIMITE_EXCEDIDO` e `METODO_INVALIDO`.

### `mcp-tools/src/server.ts`

- Criado servidor MCP por request.
- Adicionado segredo compartilhado.
- Adicionado contexto de usuário e conversa pelos headers.
- Tools financeiras recusam contexto ausente.
- Criado endpoint interno protegido de perfil.
- Adicionado tratamento de exceção do transporte.
- Body JSON limitado a 256 KiB.
- Host configurável.
- Aplicação exportada para testes.
- `listen` condicionado à execução como processo principal.

### `mcp-tools/src/test-tools.ts`

- Todos os testes passaram a usar contexto explícito.
- Mantidos testes de catálogo, intenção, PIX e cartão.
- Adicionado isolamento por usuário.
- Adicionado isolamento por conversa.
- Adicionado método inválido.
- Adicionada expiração forçada.
- Mantidos intenção inexistente, intenção paga e limite excedido.

---

## 6. Variáveis de ambiente

### Backend

```dotenv
PORT=3000
HOST=127.0.0.1
MCP_URL=http://localhost:3001/mcp
MCP_SHARED_SECRET=dev_mcp_shared_secret_change_me
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:1.7b
JWT_SECRET=super_secret_jwt_key_payments_2026
JWT_EXPIRES_IN=1h
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### MCP

```dotenv
PORT=3001
HOST=127.0.0.1
INTENT_EXPIRATION_MINUTES=6
DEFAULT_CURRENCY=BRL
MCP_SHARED_SECRET=dev_mcp_shared_secret_change_me
```

### Frontend

```dotenv
VITE_API_URL=http://localhost:3000
VITE_USE_MOCKS=false
```

Os arquivos `.env` locais foram preparados para a validação, mas permanecem ignorados pelo Git. Os `.env.example` contêm somente valores de demonstração. Em qualquer ambiente exposto, `JWT_SECRET` e `MCP_SHARED_SECRET` devem ser substituídos.

---

## 7. Contratos finais relevantes

### 7.1 Chat

```http
POST /api/chat
Authorization: Bearer <jwt>
Content-Type: application/json
Accept: application/x-ndjson
```

```json
{
  "conversation_id": "conv_12345678",
  "messages": [
    {
      "role": "user",
      "content": "Pode pagar no pix"
    }
  ]
}
```

Embora o frontend possa enviar mensagens anteriores para sua experiência visual, o backend só confia na última mensagem de usuário e recompõe o restante pelo store interno.

### 7.2 Eventos NDJSON

Início de tool:

```json
{"tool":{"name":"registrar_intencao","arguments":{"produto_id":"prod_003","quantidade":1}}}
```

Resultado de tool:

```json
{"tool":{"name":"registrar_intencao","arguments":{"produto_id":"prod_003","quantidade":1},"result":{"intencao_id":"int_xxxxxxxx","status":"pendente"}}}
```

Mensagem do assistente:

```json
{"message":{"role":"assistant","content":"Intenção registrada com sucesso..."}}
```

Fim:

```json
{"done":true}
```

### 7.3 Contexto MCP interno

```http
x-mcp-secret: <segredo compartilhado>
x-user-id: usr_std_02
x-conversation-id: conv_12345678
```

Esses headers não são enviados pelo frontend diretamente ao MCP.

---

## 8. Testes executados e resultados

## 8.1 Frontend

### Testes

```powershell
npm.cmd --prefix frontend test
```

Resultado final:

```text
Test Files  3 passed (3)
Tests       36 passed (36)
```

Cobertura funcional exercitada:

- parser NDJSON;
- eventos divididos em múltiplos chunks;
- CRLF e última linha sem newline;
- interrupção e timeout;
- erros HTTP e autenticação;
- contrato do body do chat;
- login mock;
- catálogo, intenção, PIX e cartão mock;
- cinco códigos de recusa;
- atualização do perfil.

### Lint

```powershell
npm.cmd --prefix frontend run lint
```

Resultado: concluído sem erros ou avisos.

### Build

```powershell
npm.cmd --prefix frontend run build
```

Resultado: TypeScript e Vite concluídos com sucesso.

### Observação ambiental

Uma execução do Vitest dentro do sandbox recebeu `Access is denied` do `esbuild` ao tentar ler um diretório pai. O mesmo comando foi repetido com a permissão de filesystem necessária e os 36 testes passaram. Não era falha de código ou de teste.

## 8.2 Backend

```powershell
npm.cmd --prefix backend test
```

Resultados:

```text
[OK] Hashing e verificação scrypt
[OK] Autenticação de usuários e perfis
[OK] Emissão e verificação de JWT
[OK] Controle e débito de limites
[OK] Login e proteção do chat
[OK] Descoberta/execução das 3 tools pelo agente
[OK] Compras aprovadas com PIX e cartão
[OK] Limite atualizado e bloqueio por LIMITE_EXCEDIDO
[OK] Intenção isolada por usuário/conversa e histórico completo
```

Build:

```powershell
npm.cmd --prefix backend run build
```

Resultado: TypeScript concluído sem erro.

## 8.3 MCP

```powershell
npm.cmd --prefix mcp-tools run test:tools
```

Resultados:

```text
[OK] listar_catalogo
[OK] registrar_intencao
[OK] realizar_compra (PIX)
[OK] realizar_compra (Cartão)
[OK] Erro INTENCAO_JA_PAGA
[OK] Erro INTENCAO_INVALIDA
[OK] Erro LIMITE_EXCEDIDO
[OK] Isolamento por usuário e conversa
[OK] Erros METODO_INVALIDO e INTENCAO_EXPIRADA
```

Build:

```powershell
npm.cmd --prefix mcp-tools run build
```

Resultado: TypeScript concluído sem erro.

## 8.4 Verificações adicionais

- `git diff --check`: sem erro de whitespace; somente avisos LF/CRLF esperados no Windows.
- Auditorias npm executadas durante o trabalho: nenhuma vulnerabilidade conhecida reportada.
- Logs dos três serviços: sem erro de runtime ao final dos fluxos.
- Portas `3000`, `3001` e `5173` foram liberadas após a validação.

---

## 9. Validação real com Ollama

### 9.1 Instalação verificada

Executável:

```text
C:\Users\kauan\AppData\Local\Programs\Ollama\ollama.exe
```

Versão verificada:

```text
0.33.2
```

Modelo baixado:

```text
qwen3:1.7b
```

O download foi de aproximadamente 1,4 GB. A API local respondeu em `127.0.0.1:11434`.

### 9.2 Smoke test via API

Fluxo executado com a mesma conversa:

```text
O que vocês têm à venda?
Quero comprar o produto 3
Pode pagar no pix
```

Tools observadas:

```text
listar_catalogo
registrar_intencao(prod_003, 1)
realizar_compra(intenção retornada, pix)
```

Resultado observado:

```text
status: aprovado
valor: 249.90
metodo_pagamento: pix
limite_restante: 1750.10
```

### 9.3 Fluxos reais no navegador

#### PIX aprovado

- Perfil: João Souza.
- Produto usado na captura final: `prod_007`.
- Valor: R$ 49,90.
- Resultado: aprovado.
- Limite mostrado após a sequência de testes: R$ 1.700,20.

#### Cartão aprovado

- Perfil: Maria Silva.
- Produto: `prod_005`.
- Valor: R$ 129,90.
- Resultado: aprovado.
- Limite restante: R$ 14.870,10.

#### Limite excedido

- Perfil: Carlos Lima.
- Limite: R$ 100,00.
- Produto: `prod_006`.
- Valor da intenção: R$ 1.899,00.
- Resultado: `LIMITE_EXCEDIDO`.
- Limite permaneceu inalterado.

#### Intenção inválida

- Entrada: `Pague a intenção int_falsa_123 no pix`.
- Resultado: `INTENCAO_INVALIDA`.
- Nenhum débito ou redução de estoque foi realizado.

Os valores dos stores são mantidos em memória. Ao reiniciar MCP e backend, usuários, estoque e intenções retornam ao estado inicial.

---

## 10. Evidências visuais

### PIX aprovado

![Compra PIX aprovada](frontend/docs/screenshots/compra-pix-aprovada.png)

### Cartão aprovado

![Compra com cartão aprovada](frontend/docs/screenshots/compra-cartao-aprovada.png)

### Limite excedido

![Limite excedido](frontend/docs/screenshots/limite-excedido.png)

### Intenção inválida

![Intenção inválida](frontend/docs/screenshots/intencao-invalida.png)

---

## 11. Como executar a solução final

### 11.1 Preparar o modelo

O modelo já foi instalado no ambiente validado. Em outra máquina:

```powershell
ollama pull qwen3:1.7b
```

### 11.2 Preparar variáveis e dependências

Na raiz do projeto:

```powershell
Copy-Item mcp-tools/.env.example mcp-tools/.env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env -Force

npm.cmd --prefix mcp-tools ci
npm.cmd --prefix backend ci
npm.cmd --prefix frontend ci
```

### 11.3 Iniciar os serviços

Terminal 1:

```powershell
ollama serve
```

Terminal 2:

```powershell
npm.cmd --prefix mcp-tools run dev
```

Terminal 3:

```powershell
npm.cmd --prefix backend run dev
```

Terminal 4:

```powershell
npm.cmd --prefix frontend run dev
```

Abrir:

```text
http://127.0.0.1:5173
```

### 11.4 Usuários

| Username | Senha | Limite inicial |
| --- | --- | ---: |
| `cliente_vip` | `123` | R$ 15.000,00 |
| `cliente_padrao` | `123` | R$ 2.000,00 |
| `cliente_sem_saldo` | `123` | R$ 100,00 |

---

## 12. Checklist do desafio

- [x] Frontend e backend rodando localmente.
- [x] Login funcionando.
- [x] Chat inacessível sem JWT.
- [x] Servidor MCP com três tools.
- [x] Tools descobertas pelo agente.
- [x] Contrato de `listar_catalogo` atendido.
- [x] Contrato de `registrar_intencao` atendido.
- [x] Contrato de `realizar_compra` atendido.
- [x] Preço e total calculados no servidor.
- [x] Compra concluída com PIX.
- [x] Compra concluída com cartão.
- [x] ID inventado recusado.
- [x] Intenção de outro usuário recusada.
- [x] Intenção de outra conversa recusada.
- [x] Intenção já paga recusada.
- [x] Intenção expirada recusada.
- [x] Método inválido recusado.
- [x] Limite excedido recusado.
- [x] Limite armazenado e validado no backend de pagamentos.
- [x] Estoque validado antes da compra.
- [x] Histórico completo enviado ao agente nos turnos seguintes.
- [x] README com execução e modelo.
- [x] Testes automatizados.
- [x] Screenshots de PIX e cartão.
- [x] Screenshot de limite excedido.
- [x] Screenshot de intenção inválida.

---

## 13. Limitações conhecidas e próximos passos opcionais

Estas limitações não impedem os requisitos do desafio, mas são relevantes para uma evolução além da demonstração local:

1. **Persistência em memória:** reiniciar os serviços restaura saldo, estoque e intenções. Produção exigiria banco transacional.
2. **Concorrência entre processos:** a trava de conversa e os stores são locais ao processo. Escala horizontal exigiria Redis ou banco.
3. **Atomicidade financeira:** débito de limite, estoque e status deveriam ocorrer em uma transação de banco.
4. **Segredo de demonstração:** os valores dos `.env.example` precisam ser substituídos fora do ambiente local.
5. **Auditoria persistente:** é recomendável registrar cada tool call, usuário, intenção, valor, resultado e timestamp em storage imutável.
6. **Rate limiting:** login, chat e MCP poderiam receber limites por IP/usuário.
7. **Expiração do histórico:** o store de conversas pode ganhar TTL e limpeza periódica.
8. **Testes com múltiplos modelos:** o fallback foi validado com `qwen3:1.7b`; outros modelos podem ser adicionados a uma matriz de avaliação.
9. **Acessibilidade avançada:** a interface possui labels, foco e roles, mas uma auditoria com leitor de tela real ainda seria útil.
10. **TLS e rede:** a solução foi intencionalmente construída para localhost; exposição externa exigiria HTTPS, rotação de segredos e políticas adicionais.

---

## 14. Conclusão

A principal diferença entre o estado inicial e o resultado final é que a aplicação deixou de ser apenas uma interface capaz de simular respostas e passou a possuir uma cadeia confiável de identidade e autorização:

```text
JWT validado
  -> histórico controlado pelo backend
  -> contexto autenticado enviado ao MCP
  -> intenção vinculada a usuário e conversa
  -> preço, limite e estoque validados no servidor
  -> resultado real exibido pelo frontend
```

Os problemas encontrados durante a execução com o Ollama real — ausência de `tool_call`, latência de raciocínio e texto alucinado após uma tool correta — também foram tratados. Assim, a validação não depende somente de mocks: os fluxos finais foram executados no frontend com backend, MCP e `qwen3:1.7b`, e as evidências estão incluídas neste repositório.
