import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { bundleNode22Lambda } from './lambda-bundler';

export interface PaymentToolsProps {
  /**
   * Prefixo obrigatório para isolamento em conta compartilhada (ex: 'alvaro-').
   */
  readonly resourcePrefix: string;
  /**
   * Tabela de usuários (`alvaro-usuarios`) usada para leitura de saldo/limite.
   */
  readonly usuariosTable: dynamodb.ITable;
}

/**
 * Construto das Lambdas de Ferramentas MCP/Agênticas (Épico 03).
 *
 * Princípio de menor privilégio: cada Lambda recebe apenas a permissão exata
 * necessária na tabela que manipula, sem acesso a outras tabelas ou ao Bedrock.
 */
export class PaymentTools extends Construct {
  public readonly consultarSaldoLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: PaymentToolsProps) {
    super(scope, id);

    const { resourcePrefix, usuariosTable } = props;
    const toolsDir = path.join(__dirname, '../../tools');

    // TOOL-01: Consulta de Catálogo e Saldo do usuário autenticado
    this.consultarSaldoLambda = new lambda.Function(this, 'ConsultarSaldoHandler', {
      functionName: `${resourcePrefix}tool-consultar-saldo`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      code: bundleNode22Lambda(path.join(toolsDir, 'consultar-saldo/index.ts'), toolsDir),
      environment: {
        USUARIOS_TABLE_NAME: usuariosTable.tableName,
      },
    });

    // Menor privilégio estrito: somente dynamodb:GetItem na tabela alvaro-usuarios.
    usuariosTable.grant(this.consultarSaldoLambda, 'dynamodb:GetItem');

    new cdk.CfnOutput(this, 'ConsultarSaldoLambdaArnOutput', {
      value: this.consultarSaldoLambda.functionArn,
      description: 'ARN da Lambda TOOL-01 (Consulta de Catálogo e Saldo)',
      exportName: `${resourcePrefix}tool-consultar-saldo-arn`,
    });
  }
}
