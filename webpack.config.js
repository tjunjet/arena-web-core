const path = require('path');
const webpack = require("webpack");
var TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => ({
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: argv.mode == 'development' ? 'index.js' : 'index.min.js',
  },
  mode: argv.mode == 'development' ? 'development' : 'production',
  devtool: argv.mode == 'development' ? 'source-map' : undefined,
  module: {
    rules: [
      {
        test: /\.js?$/,
        exclude: /node_modules/,
        use: [{
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: [
              ['@babel/transform-runtime']
            ]
          }
        }]
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.glsl$/i,
        use: [
          {
            loader: path.resolve('webpack-glsl-minifier.js'),
          }
        ],
      },
    ],
  },
  devtool: argv.mode == 'development' ? 'source-map' : undefined,
  devServer: {
      host: 'localhost',
      port: 8000,
      contentBase: __dirname
  },
  optimization: argv.mode == 'development' ? { minimize: false } : {
      minimize: true,
      minimizer: [new TerserPlugin({
        terserOptions: {
            mangle: true,
            compress: {
                passes: 2,
                defaults: true,
            },
            format: {
                comments: false
            }
        },
        extractComments: false,
      })],
  },
  resolve: {
    extensions: ['.js']
  }
});

