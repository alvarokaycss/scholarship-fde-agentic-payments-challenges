import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { createHandler, DynamoGetClient } from './index';

describe('TOOL-01: consultar-saldo e catálogo', () => {
  it('retorna saldo do usuário no DynamoDB e catálogo completo quando categoria não é informada', async () => {
    process.env.USUARIOS_TABLE_NAME = 'alvaro-usuarios';
    let capturedCommand: GetCommand | undefined;

    const fakeClient: DynamoGetClient = {
      async send(command: GetCommand) {
        capturedCommand = command;
        return {
          Item: {
            usuario_id: 'sub-user-123',
            nome: 'Maria Alyce',
            saldo_disponivel: 15000,
          },
        };
      },
    };

    const run = createHandler(fakeClient);
    const response = await run({ usuario_id: 'sub-user-123' });

    assert.equal(capturedCommand?.input.TableName, 'alvaro-usuarios');
    assert.deepEqual(capturedCommand?.input.Key, { usuario_id: 'sub-user-123' });
    assert.equal(response.usuario_encontrado, true);
    assert.equal(response.usuario_id, 'sub-user-123');
    assert.equal(response.nome, 'Maria Alyce');
    assert.equal(response.saldo_disponivel, 15000);
    assert.equal(response.moeda, 'BRL');
    assert.equal(response.produtos.length, 7);
  });

  it('filtra catálogo por categoria ignorando maiúsculas/minúsculas', async () => {
    process.env.USUARIOS_TABLE_NAME = 'alvaro-usuarios';
    const fakeClient: DynamoGetClient = {
      async send() {
        return {
          Item: { usuario_id: 'sub-user-123', saldo_disponivel: 2000 },
        };
      },
    };

    const run = createHandler(fakeClient);
    const response = await run({ usuario_id: 'sub-user-123', categoria: 'JOGOS' });

    assert.equal(response.produtos.length, 1);
    assert.equal(response.produtos[0].id, 'prod_005');
    assert.equal(response.produtos[0].categoria, 'jogos');
  });

  it('retorna fallback gracioso quando o usuário não existe na tabela alvaro-usuarios', async () => {
    process.env.USUARIOS_TABLE_NAME = 'alvaro-usuarios';
    const fakeClient: DynamoGetClient = {
      async send() {
        return {};
      },
    };

    const run = createHandler(fakeClient);
    const response = await run({ usuario_id: 'sub-inexistente' });

    assert.equal(response.usuario_encontrado, false);
    assert.equal(response.usuario_id, 'sub-inexistente');
    assert.equal(response.saldo_disponivel, 0);
    assert.equal(response.produtos.length, 7);
    assert.ok(response.mensagem && response.mensagem.length > 0);
  });

  it('falha explicitamente quando usuario_id não é fornecido', async () => {
    process.env.USUARIOS_TABLE_NAME = 'alvaro-usuarios';
    const fakeClient: DynamoGetClient = {
      async send() {
        throw new Error('Não deveria consultar DynamoDB sem usuario_id');
      },
    };

    const run = createHandler(fakeClient);
    await assert.rejects(() => run({}), /usuario_id/);
  });
});
