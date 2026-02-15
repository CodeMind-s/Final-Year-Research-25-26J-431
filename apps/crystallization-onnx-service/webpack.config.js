const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/crystallization-onnx-service'),
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  node: {
    __dirname: false,
  },
  ...(process.env.NODE_ENV !== 'production' && {
    devServer: {
      inspect: 9235,
    },
  }),
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: [
        './src/assets',
        {
          input: join(__dirname, '../../proto'),
          glob: 'crystallization-prediction.proto',
          output: 'proto',
        },
      ],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMaps: true,
    }),
    new CopyPlugin({
      patterns: [
        {
          from: join(__dirname, 'models'),
          to: join(__dirname, '../../dist/apps/crystallization-onnx-service/models'),
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
};
