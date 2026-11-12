/**
 * Stub inicial da AWS Lambda de streaming NDJSON do Webchat (Borda da API).
 *
 * Será substituído na Tarefa #17 [API-01] pela integração real com:
 * - Extração obrigatória de `usuario_id` via claim `sub` do JWT do Cognito
 * - Persistência de sessão na tabela `alvaro-conversas`
 * - Invocação e streaming do Bedrock AgentCore Runtime
 */
export const handler = async (event: unknown): Promise<{ statusCode: number; body: string }> => {
  return {
    statusCode: 501,
    body: JSON.stringify({
      message: 'Endpoint POST /chat provisionado. Integração com AgentCore pendente (#17 [API-01]).',
      eventReceived: Boolean(event),
    }),
  };
};
