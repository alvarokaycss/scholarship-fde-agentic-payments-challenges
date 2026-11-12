#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AgenticPaymentsStack } from '../lib/root-stack';

const app = new cdk.App();

// Guardrails inegociáveis do Desafio 1
const DEFAULT_ACCOUNT = '006739439488';
const MANDATORY_REGION = 'us-east-1';
const RESOURCE_PREFIX = 'alvaro-';

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT || DEFAULT_ACCOUNT,
  region: MANDATORY_REGION,
};

// Stack principal com prefixação de isolamento para conta compartilhada
new AgenticPaymentsStack(app, 'alvaro-agentic-payments-stack', {
  stackName: `${RESOURCE_PREFIX}agentic-payments-stack`,
  description: 'Stack principal do Desafio 1: Pagamentos Agênticos com Strands Agent no Bedrock (Bolsista Alvaro Kayc)',
  env,
  resourcePrefix: RESOURCE_PREFIX,
  tags: {
    Project: 'nexus-store-agentic-payments',
    Challenge: 'desafio-1-aws',
    Sprint: 'sprint-2',
    Owner: 'alvaro-kayc',
    Environment: 'development',
  },
});

app.synth();
