import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { bundleNode22Lambda } from './lambda-bundler';

export interface ChatApiProps {
  /**
   * Prefixo obrigatório para isolamento em conta compartilhada (ex: 'alvaro-').
   */
  readonly resourcePrefix: string;
  /**
   * User Pool do Cognito usado pelo autorizador JWT do API Gateway.
   */
  readonly userPool: cognito.IUserPool;
  /**
   * Origem HTTPS exata da distribuição CloudFront para restrição estrita de CORS.
   */
  readonly allowedOrigin: string;
  /**
   * Tabela de conversas (única tabela DynamoDB que a Lambda do chat pode acessar).
   */
  readonly conversasTable: dynamodb.ITable;
}

/**
 * Construto de Borda da API (Amazon API Gateway REST + JWT Authorizer + Streaming).
 *
 * Responsável por:
 * 1. Expor o endpoint POST /chat protegido por CognitoUserPoolsAuthorizer (rejeita 401 antes da Lambda).
 * 2. Habilitar ResponseTransferMode.STREAM na integração Lambda para streaming NDJSON contínuo.
 * 3. Configurar CORS restrito à origem do CloudFront, incluindo GatewayResponses (401, 403, 4xx, 5xx).
 * 4. Aplicar menor privilégio estrito na Lambda do chat (apenas leitura/escrita em alvaro-conversas).
 */
export class ChatApi extends Construct {
  public readonly restApi: apigw.RestApi;
  public readonly chatLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: ChatApiProps) {
    super(scope, id);

    const { resourcePrefix, userPool, allowedOrigin, conversasTable } = props;
    const apiDir = path.join(__dirname, '../../api');

    // 1. Lambda da Borda do Chat (Node.js 22 + bundling determinístico in-process via esbuild)
    this.chatLambda = new lambda.Function(this, 'ChatHandler', {
      functionName: `${resourcePrefix}chat-api-handler`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      memorySize: 256,
      timeout: cdk.Duration.minutes(5),
      code: bundleNode22Lambda(path.join(apiDir, 'index.ts'), apiDir),
      environment: {
        CONVERSAS_TABLE_NAME: conversasTable.tableName,
        ALLOWED_ORIGIN: allowedOrigin,
      },
    });

    // Menor privilégio estrito: a Lambda do chat só acessa a tabela de conversas.
    // Acesso a usuários, intenções e Bedrock direto é proibido nesta camada.
    conversasTable.grantReadWriteData(this.chatLambda);

    // 2. Amazon API Gateway REST
    this.restApi = new apigw.RestApi(this, 'ChatRestApi', {
      restApiName: `${resourcePrefix}chat-api`,
      description: 'API Gateway REST da Nexus Store com autorizador JWT Cognito e streaming NDJSON',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 20,
        throttlingBurstLimit: 40,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [allowedOrigin],
        allowMethods: ['POST', 'GET', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // 3. GatewayResponses com CORS para erros emitidos pelo próprio Gateway (401/403/5xx)
    // Sem isso, requisições rejeitadas pelo autorizador chegam ao navegador sem header CORS.
    const corsErrorHeaders = {
      'Access-Control-Allow-Origin': `'${allowedOrigin}'`,
      'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      'Access-Control-Allow-Methods': "'POST,GET,OPTIONS'",
    };

    this.restApi.addGatewayResponse('UnauthorizedCors', {
      type: apigw.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: corsErrorHeaders,
    });

    this.restApi.addGatewayResponse('AccessDeniedCors', {
      type: apigw.ResponseType.ACCESS_DENIED,
      statusCode: '403',
      responseHeaders: corsErrorHeaders,
    });

    this.restApi.addGatewayResponse('Default4xxCors', {
      type: apigw.ResponseType.DEFAULT_4XX,
      responseHeaders: corsErrorHeaders,
    });

    this.restApi.addGatewayResponse('Default5xxCors', {
      type: apigw.ResponseType.DEFAULT_5XX,
      responseHeaders: corsErrorHeaders,
    });

    // 4. Autorizador JWT do Cognito (valida assinatura e expiração na borda)
    const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      authorizerName: `${resourcePrefix}cognito-authorizer`,
      cognitoUserPools: [userPool],
      identitySource: apigw.IdentitySource.header('Authorization'),
    });

    // 5. Endpoint POST /chat com ResponseTransferMode.STREAM
    const chatResource = this.restApi.root.addResource('chat');
    chatResource.addMethod(
      'POST',
      new apigw.LambdaIntegration(this.chatLambda, {
        proxy: true,
        responseTransferMode: apigw.ResponseTransferMode.STREAM,
      }),
      {
        authorizer: cognitoAuthorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
      },
    );

    // 6. Output da URL pública da API
    new cdk.CfnOutput(this, 'ChatApiUrlOutput', {
      value: this.restApi.url,
      description: 'URL base do Amazon API Gateway REST (borda protegida por Cognito JWT)',
      exportName: `${resourcePrefix}chat-api-url`,
    });
  }
}
