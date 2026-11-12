import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export interface FrontendHostProps {
  /**
   * Prefixo obrigatório para isolamento em conta compartilhada (ex: 'alvaro-').
   */
  readonly resourcePrefix: string;
  /**
   * ID da conta AWS para garantir unicidade global do nome do bucket S3.
   */
  readonly accountId: string;
}

/**
 * Construto de Borda Segura e Hospedagem Estática para o Frontend React (SPA).
 *
 * Responsável por:
 * 1. Provisionar um bucket Amazon S3 100% privado (BlockPublicAccess.BLOCK_ALL, sem website hosting).
 * 2. Distribuir o conteúdo globalmente via Amazon CloudFront com HTTPS obrigatório.
 * 3. Conectar o CloudFront ao S3 usando Origin Access Control (OAC) com assinatura SigV4
 *    e política de bucket restrita ao ARN da distribuição.
 * 4. Configurar respostas de erro 403/404 -> /index.html (HTTP 200) para roteamento SPA.
 * 5. Configurar autoDeleteObjects + RemovalPolicy.DESTROY para teardown limpo via cdk destroy.
 */
export class FrontendHost extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendHostProps) {
    super(scope, id);

    const { resourcePrefix, accountId } = props;

    // 1. Bucket S3 100% Privado
    // Nomes de buckets S3 são globalmente únicos em toda a AWS; incluir accountId evita colisões.
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${resourcePrefix}frontend-bucket-${accountId}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 2. Distribuição CloudFront com Origin Access Control (OAC)
    // S3BucketOrigin.withOriginAccessControl cria o OAC e anexa automaticamente a Bucket Policy
    // restringindo s3:GetObject apenas ao principal cloudfront.amazonaws.com com SourceArn da distribuição.
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${resourcePrefix}frontend-distribution (S3 Privado + OAC)`,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      // Tratamento de rotas client-side da SPA (React Router)
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // 3. Outputs para pipeline de deploy, CORS do API Gateway e acesso do avaliador
    new cdk.CfnOutput(this, 'FrontendBucketNameOutput', {
      value: this.bucket.bucketName,
      description: 'Nome do bucket S3 privado que hospeda o build do frontend',
      exportName: `${resourcePrefix}frontend-bucket-name`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionIdOutput', {
      value: this.distribution.distributionId,
      description: 'ID da distribuição Amazon CloudFront (usado para invalidação de cache)',
      exportName: `${resourcePrefix}cloudfront-distribution-id`,
    });

    new cdk.CfnOutput(this, 'CloudFrontUrlOutput', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'URL pública HTTPS da aplicação no CloudFront',
      exportName: `${resourcePrefix}cloudfront-url`,
    });
  }
}
