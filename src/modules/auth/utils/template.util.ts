/**
 * Auth View Templates
 * @module auth/utils
 * @description Generic Handlebars renderer for the auth module.
 * Accepts an absolute template path — no knowledge of specific views.
 * Views own their own paths and data types.
 */

import fs from 'node:fs';
import Handlebars from 'handlebars';
import type { TemplateDelegate } from 'handlebars';

const compiledViews = new Map<string, TemplateDelegate>();

/**
 * Compiles and renders a Handlebars template at the given absolute path.
 * Compiled templates are cached in memory for subsequent calls.
 */
export const renderView = (absolutePath: string, data: unknown): string => {
    const cached = compiledViews.get(absolutePath);
    const template =
        cached ??
        (() => {
            const source = fs.readFileSync(absolutePath, 'utf-8');
            const compiled = Handlebars.compile(source);
            compiledViews.set(absolutePath, compiled);
            return compiled;
        })();

    return template(data);
};
