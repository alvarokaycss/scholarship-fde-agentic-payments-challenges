import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as esbuild from 'esbuild';

/**
 * Empacota uma Lambda TypeScript in-process via esbuild, evitando dependência de Docker ou npx.
 * O AWS SDK v3 já está disponível no runtime NODEJS_22_X, portanto é marcado como external.
 */
export function bundleNode22Lambda(entryFile: string, assetRootDir: string): lambda.Code {
  return lambda.Code.fromAsset(assetRootDir, {
    bundling: {
      image: lambda.Runtime.NODEJS_22_X.bundlingImage,
      local: {
        tryBundle(outputDir: string): boolean {
          esbuild.buildSync({
            entryPoints: [entryFile],
            bundle: true,
            platform: 'node',
            target: 'node22',
            minify: true,
            sourcemap: true,
            external: ['@aws-sdk/*'],
            outfile: path.join(outputDir, 'index.js'),
          });
          return true;
        },
      },
    },
  });
}
