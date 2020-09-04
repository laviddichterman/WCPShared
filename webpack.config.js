const path = require('path');

module.exports = [
  'source-map'
].map(devtool => ({
  //mode: 'development',
  entry: './src/index.js',
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'wcpshared.js',
    library: 'WCPShared',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 9000
  },
  //devtool,
  // optimization: {
  //   runtimeChunk: true
  // },
  externals: {
    moment: {
      commonjs: 'moment',
      commonjs2: 'moment',
      amd: 'moment',
      root: 'moment',
    },
  },
}));