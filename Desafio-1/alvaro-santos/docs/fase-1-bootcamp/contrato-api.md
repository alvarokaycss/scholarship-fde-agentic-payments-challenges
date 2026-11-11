# Guia de Integração e Contrato de API para o Frontend (Pessoa B)
## Desafio: Chatbot com Tools MCP de Pagamentos

> **Objetivo:** Este documento define os contratos de dados, rotas de autenticação, protocolo de streaming HTTP em tempo real e modelos TypeScript para que o desenvolvimento do Frontend ocorra de forma simples, direta e com suporte a mocks locais.
> **Alinhamento com Instrutor:** Comunicação via **HTTP Streaming** (`fetch` com `ReadableStream` / NDJSON), autenticação JWT (1h) e persistência em memória de execução (sem necessidade de Docker ou banco externo).

---

## 1. Perfis de Usuário para Testes

O frontend pode exibir uma seleção rápida de botões de login com estes 3 perfis:

| Username | Senha | Nome Completo | Limite Inicial | Finalidade do Teste |
|---|---|---|---|---|
| `cliente_vip` | `123` | **Maria Silva** | **R$ 15.000,00** | Compras de múltiplos produtos e alto valor |
| `cliente_padrao` | `123` | **João Souza** | **R$ 2.000,00** | Fluxo feliz padrão com PIX e Cartão |
| `cliente_sem_saldo` | `123` | **Carlos Lima** | **R$ 100,00** | Forçar e validar o erro de `LIMITE_EXCEDIDO` |

---

## 2. Autenticação (REST API)

### 2.1 `POST /api/auth/login`
Autentica o usuário e retorna o token JWT e os limites disponíveis.

#### Payload de Envio (Request):
```json
{
  "username": "cliente_padrao",
  "password": "123"
}
```

#### Resposta com Sucesso (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_std_02",
    "username": "cliente_padrao",
    "name": "João Souza",
    "limite_total": 2000.00,
    "limite_disponivel": 2000.00
  },
  "expiresIn": "1h"
}
```

#### Resposta de Erro (401 Unauthorized):
```json
{
  "error": "Credenciais inválidas. Verifique seu usuário e senha."
}
```

---

### 2.2 `GET /api/user/me`
Consulta o perfil e o saldo/limite atualizado do usuário logado.

- **Headers:** `Authorization: Bearer <token>`
- **Resposta (200 OK):**
```json
{
  "id": "usr_std_02",
  "username": "cliente_padrao",
  "name": "João Souza",
  "limite_total": 2000.00,
  "limite_disponivel": 1750.10
}
```

---

## 3. Comunicação do Chat em Tempo Real (HTTP Streaming)

O chat utiliza **HTTP Streaming** (`POST /api/chat`) com formato **NDJSON (`application/x-ndjson`)**. 

A cada turno, o frontend envia o histórico de mensagens e lê a resposta do backend linha por linha através de um stream contínuo.

### 3.1 Endpoint `POST /api/chat`

- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Body:**
```json
{
  "messages": [
    { "role": "user", "content": "Quero comprar um Headset Gamer" }
  ]
}
```

---

### 3.2 Linhas de Eventos Transmitidas pelo Backend (NDJSON Stream)

Durante a geração da resposta pelo agente, o backend envia linhas JSON (`\n` delimitado) com os seguintes eventos:

#### 1. Token de Texto da Resposta (`chunk`):
```json
{
  "message": {
    "role": "assistant",
    "content": "Temos "
  }
}
```
*💡 Comportamento de UI:* O frontend acumula o texto (`content`) no balão de mensagem do assistente em tempo real.

---

#### 2. Execução de Tool MCP (`tool`):
Enviado quando o modelo aciona uma ferramenta (como `listar_catalogo`, `registrar_intencao` ou `realizar_compra`):
```json
{
  "tool": {
    "name": "registrar_intencao",
    "arguments": {
      "produto_id": "prod_003",
      "quantidade": 1
    },
    "result": {
      "intencao_id": "int_a1b2c3d4",
      "produto_id": "prod_003",
      "quantidade": 1,
      "valor_total": 249.90,
      "moeda": "BRL",
      "status": "pendente",
      "expira_em": "2026-08-28T12:45:00.000Z"
    }
  }
}
```
*💡 Comportamento de UI:* O frontend pode renderizar um card visual com o resumo da intenção de compra ou comprovante de pagamento.

---

#### 3. Fim do Fluxo (`done`):
```json
{
  "done": true
}
```
*💡 Comportamento de UI:* Habilita o campo de input para a próxima mensagem do usuário.

---

## 4. Exemplo de Consumo no React (Hook de Chat)

```tsx
export async function sendChatMessage(messages: any[], token: string, onEvent: (evt: any) => void) {
  const response = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ messages })
  });

  if (!response.ok || !response.body) {
    throw new Error(`Erro na chamada do chat: ${response.status}`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line);
      onEvent(parsed);
    }
  }
}
```

---

## 5. Modelos TypeScript Compartilhados

```ts
export type Role = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id?: string;
  role: Role;
  content: string;
  tool_calls?: any[];
  tool?: {
    name: string;
    arguments: Record<string, any>;
    result: any;
  };
}

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  limite_total: number;
  limite_disponivel: number;
}
```
