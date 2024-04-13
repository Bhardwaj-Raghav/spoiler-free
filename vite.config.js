import { normalizePath } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { resolve } from 'path';

export default {
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: normalizePath(resolve(__dirname, './assets')),
                    dest: './'
                },
                {
                    src: normalizePath(resolve(__dirname, 'manifest.json')),
                    dest: './'
                }
            ]
        })
    ]
}