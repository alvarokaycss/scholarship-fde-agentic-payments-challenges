import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { CatalogProduct, listCatalogProducts } from '../shared/catalog';

export interface ConsultarSaldoInput {
  readonly usuario_id?: string;
  readonly categoria?: string;
}

export interface ConsultarSaldoOutput {
  readonly usuario_encontrado: boolean;
  readonly usuario_id: string;
  readonly nome?: string;
  readonly saldo_disponivel: number;
  readonly moeda: 'BRL';
  readonly produtos: CatalogProduct[];
  readonly mensagem?: string;
}

export interface DynamoGetClient {
  send(command: GetCommand): Promise<{ Item?: Record<string, unknown> }>;
}

let defaultDocClient: DynamoDBDocumentClient | undefined;

function getDefaultDocClient(): DynamoDBDocumentClient {
  if (!defaultDocClient) {
    const client = new DynamoDBClient({});
    defaultDocClient = DynamoDBDocumentClient.from(client);
  }
  return defaultDocClient;
}

/**
 * Factory do handler para permitir injeção do cliente DynamoDB em testes unitários.
 */
export function createHandler(docClient?: DynamoGetClient) {
  return async (event: ConsultarSaldoInput): Promise<ConsultarSaldoOutput> => {
    const usuarioId = typeof event?.usuario_id === 'string' ? event.usuario_id.trim() : '';
    if (!usuarioId) {
      throw new Error('Parâmetro obrigatório ausente: usuario_id deve ser fornecido pelo runtime autorizado.');
    }

    const tableName = process.env.USUARIOS_TABLE_NAME;
    if (!tableName) {
      throw new Error('Variável de ambiente obrigatória ausente: USUARIOS_TABLE_NAME.');
    }

    const produtos = listCatalogProducts(event.categoria);
    const client = docClient ?? getDefaultDocClient();

    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { usuario_id: usuarioId },
        ProjectionExpression: 'usuario_id, nome, saldo_disponivel',
      }),
    );

    if (!result.Item) {
      return {
        usuario_encontrado: false,
        usuario_id: usuarioId,
        saldo_disponivel: 0,
        moeda: 'BRL',
        produtos,
        mensagem:
          'Usuário autenticado não possui registro de saldo provisionado na loja. Solicite a ativação do limite.',
      };
    }

    const rawSaldo = result.Item.saldo_disponivel;
    const saldoDisponivel = typeof rawSaldo === 'number' && Number.isFinite(rawSaldo) ? rawSaldo : 0;
    const nome = typeof result.Item.nome === 'string' ? result.Item.nome : undefined;

    return {
      usuario_encontrado: true,
      usuario_id: usuarioId,
      ...(nome ? { nome } : {}),
      saldo_disponivel: saldoDisponivel,
      moeda: 'BRL',
      produtos,
    };
  };
}

export const handler = createHandler();
