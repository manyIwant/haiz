import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/main.js',
  output: {
    file: 'bundle/app.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [
    resolve({ browser: true, mainFields: ['module', 'jsnext:main', 'main'] }),
    commonjs(),
  ],
};
