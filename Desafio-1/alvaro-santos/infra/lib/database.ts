import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface PaymentsDatabaseProps {
  /**
   * Prefixo obrigatório para isolamento em conta compartilhada (ex: 'alvaro-').
   */
  readonly resourcePrefix: string;
}

/**
 * Construto de persistência no Amazon DynamoDB para o ecossistema Nexus Store.
 *
 * Responsável por provisionar as 3 tabelas fundamentais de estado:
 * 1. usuarios: Saldo, limites de compra e dados do usuário vinculado ao Cognito (sub).
 * 2. intencoes: Registro de intenções de compra com status (PENDENTE/PAGO/RECUSADO) e TTL.
 * 3. conversas: Histórico de mensagens do chat por sessão com TTL para limpeza automática.
 *
 * Princípios adotados:
 * - Billing On-Demand (PAY_PER_REQUEST): Custo zero em repouso e escalabilidade instantânea.
 * - TTL nativo: Remoção automática e sem custo de intenções expiradas e sessões inativas.
 * - RemovalPolicy.DESTROY: Ambiente de desenvolvimento/avaliação sem deixar recursos órfãos.
 */
export class PaymentsDatabase extends Construct {
  public readonly usuariosTable: dynamodb.Table;
  public readonly intencoesTable: dynamodb.Table;
  public readonly conversasTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: PaymentsDatabaseProps) {
    super(scope, id);

    const { resourcePrefix } = props;

    // 1. Tabela de Usuários (Saldo e Limites)
    // Partition Key: usuario_id (String) - Mapeado a partir da claim `sub` do JWT do Cognito
    this.usuariosTable = new dynamodb.Table(this, 'UsuariosTable', {
      tableName: `${resourcePrefix}usuarios`,
      partitionKey: {
        name: 'usuario_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 2. Tabela de Intenções de Compra
    // Partition Key: intencao_id (String) - Identificador determinístico da pré-autorização
    // TTL: expires_at (Epoch Timestamp em segundos)
    this.intencoesTable = new dynamodb.Table(this, 'IntencoesTable', {
      tableName: `${resourcePrefix}intencoes`,
      partitionKey: {
        name: 'intencao_id',
        type: dynamodb.AttributeType.STRING,
      },
      timeToLiveAttribute: 'expires_at',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 3. Tabela de Histórico de Conversas
    // Partition Key: session_id (String) - Identificador da sessão de chat
    // TTL: expires_at (Epoch Timestamp em segundos)
    this.conversasTable = new dynamodb.Table(this, 'ConversasTable', {
      tableName: `${resourcePrefix}conversas`,
      partitionKey: {
        name: 'session_id',
        type: dynamodb.AttributeType.STRING,
      },
      timeToLiveAttribute: 'expires_at',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Outputs para referência e integração com lambdas/frontend
    new cdk.CfnOutput(this, 'UsuariosTableName', {
      value: this.usuariosTable.tableName,
      description: 'Nome da tabela DynamoDB de usuários e saldos',
      exportName: `${resourcePrefix}usuarios-table-name`,
    });

    new cdk.CfnOutput(this, 'IntencoesTableName', {
      value: this.intencoesTable.tableName,
      description: 'Nome da tabela DynamoDB de intenções de compra com TTL',
      exportName: `${resourcePrefix}intencoes-table-name`,
    });

    new cdk.CfnOutput(this, 'ConversasTableName', {
      value: this.conversasTable.tableName,
      description: 'Nome da tabela DynamoDB de sessões de conversas com TTL',
      exportName: `${resourcePrefix}conversas-table-name`,
    });
  }
}
