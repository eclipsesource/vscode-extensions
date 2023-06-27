const path = require('path');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',

  entry: path.resolve(__dirname, 'src/index.ts'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    library: {
      type: 'commonjs'
    }
  },
  devtool: 'eval-source-map',
  mode: 'development',

  externals: {
    vscode: 'commonjs vscode',
    bufferutil: 'bufferutil',
    'utf-8-validate': 'utf-8-validate'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                module: 'es6'
              }
            }
          }
        ]
      }
    ]
  }
};

module.exports = config;
