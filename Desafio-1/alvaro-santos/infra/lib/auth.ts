import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthProps {
  /**
   * Prefixo obrigatório para isolamento em conta compartilhada (ex: 'alvaro-').
   */
  readonly resourcePrefix: string;
}

/**
 * Construto de Autenticação e Identidade via Amazon Cognito para a Nexus Store.
 *
 * Responsável por:
 * 1. Provisionar o User Pool fechado (auto-cadastro desabilitado).
 * 2. Garantir que apenas administradores criem usuários via convite (admin-create-user).
 * 3. Configurar o UserPoolClient público para SPA (React) com fluxo PKCE e sem clientSecret.
 * 4. Expor userPoolId e userPoolClientId para consumo pelo frontend e autorizadores do API Gateway.
 */
export class Auth extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);

    const { resourcePrefix } = props;

    // 1. Amazon Cognito User Pool Fechado
    // selfSignUpEnabled: false -> Impede chamadas públicas à API SignUp e criação não autorizada
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${resourcePrefix}user-pool`,
      selfSignUpEnabled: false,
      signInAliases: {
        username: true,
        email: true,
      },
      autoVerify: {
        email: true,
      },
      userInvitation: {
        emailSubject: 'Seu convite de acesso — Nexus Store (Pagamentos Agênticos)',
        emailBody:
          'Olá {username}, seu acesso à Nexus Store foi criado com sucesso.\n\n' +
          'Seu usuário temporário: {username}\n' +
          'Sua senha temporária: {####}\n\n' +
          'Acesse a aplicação para definir sua nova senha pessoal no primeiro login.',
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 2. User Pool Client para SPA (Single Page Application)
    // generateSecret: false -> Clientes web públicos (navegadores) não devem armazenar segredos
    this.userPoolClient = this.userPool.addClient('SpaClient', {
      userPoolClientName: `${resourcePrefix}spa-client`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true, // Suporte a fluxo PKCE
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // 3. Outputs estruturados para integração com frontend e API Gateway
    new cdk.CfnOutput(this, 'UserPoolIdOutput', {
      value: this.userPool.userPoolId,
      description: 'ID do Amazon Cognito User Pool (Autenticação Fechada)',
      exportName: `${resourcePrefix}user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientIdOutput', {
      value: this.userPoolClient.userPoolClientId,
      description: 'ID do Amazon Cognito User Pool Client para SPA pública (sem segredo)',
      exportName: `${resourcePrefix}user-pool-client-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolArnOutput', {
      value: this.userPool.userPoolArn,
      description: 'ARN do Amazon Cognito User Pool para autorizadores IAM/API Gateway',
      exportName: `${resourcePrefix}user-pool-arn`,
    });
  }
}
