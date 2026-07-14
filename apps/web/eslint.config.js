import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/** Next.js ESLint config via compatibility layer for ESLint 9 flat config */
export default [...compat.extends('next/core-web-vitals', 'next/typescript')];
