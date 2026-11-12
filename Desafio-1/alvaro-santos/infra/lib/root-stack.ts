import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PaymentsDatabase } from './database';
import { Auth } from './auth';

export interface AgenticPaymentsStackProps extends cdk.StackProps {
  /**
   * Prefixo obrigatório para isolamento em conta compartilhada (us-east-1).
   */
  readonly resourcePrefix: string;
}

/**
 * Stack principal do Desafio 1 (AWS Cloud) - Trilha AWS AI FDE (Pagamentos Agênticos)
 *
 * Responsável por orquestrar os recursos serverless do ecossistema Nexus Store:
 * - Autenticação fechada via Amazon Cognito (User Pool + Client PKCE)
 * - Persistência atômica e financeira via Amazon DynamoDB
 * - Funções AWS Lambda de tools MCP (consultar-saldo, criar-intencao, confirmar-pagamento)
 * - Agente Strands no Amazon Bedrock AgentCore Runtime
 * - API de streaming NDJSON via Amazon API Gateway
 * - Hospedagem estática segura via Amazon S3 privado + CloudFront com OAC
 */
export class AgenticPaymentsStack extends cdk.Stack {
  public readonly database: PaymentsDatabase;
  public readonly auth: Auth;

  constructor(scope: Construct, id: string, props: AgenticPaymentsStackProps) {
    super(scope, id, props);

    // Validação estrita do prefixo de governança
    if (!props.resourcePrefix.startsWith('alvaro-')) {
      throw new Error(`Violação de governança: o prefixo deve iniciar com 'alvaro-'. Recebido: ${props.resourcePrefix}`);
    }

    // Camada de Persistência (Amazon DynamoDB)
    this.database = new PaymentsDatabase(this, 'Database', {
      resourcePrefix: props.resourcePrefix,
    });

    // Camada de Identidade e Autenticação (Amazon Cognito)
    this.auth = new Auth(this, 'Auth', {
      resourcePrefix: props.resourcePrefix,
    });

    // Output inicial para confirmação de síntese do scaffolding
    new cdk.CfnOutput(this, 'ResourcePrefixOutput', {
      value: props.resourcePrefix,
      description: 'Prefixo de isolamento de governança dos recursos na conta compartilhada',
      exportName: `${props.resourcePrefix}governance-prefix`,
    });
  }
}
