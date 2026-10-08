import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import subsetFont from 'subset-font';

// The full Phosphor icon set is ~150 KB of font and ~80 KB of CSS, while the site
// uses a handful of icons. After the build, keep only the icons that actually
// appear in the generated pages (including icons chosen in the CMS).
export default function phosphorSubset() {
  return {
    name: 'phosphor-subset',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const cssPath = path.join(dist, 'vendor/phosphor/phosphor.css');
        const fontPath = path.join(dist, 'vendor/phosphor/Phosphor.woff2');

        const used = new Set();
        const scan = async (folder) => {
          for (const entry of await readdir(folder, { withFileTypes: true })) {
            const full = path.join(folder, entry.name);
            if (entry.isDirectory()) await scan(full);
            else if (/\.(html|js)$/.test(entry.name)) {
              const text = await readFile(full, 'utf8');
              for (const m of text.matchAll(/\bph-[a-z0-9-]+/g)) used.add(m[0]);
            }
          }
        };
        await scan(dist);

        const css = await readFile(cssPath, 'utf8');
        const firstIcon = css.search(/\.ph\.ph-[a-z0-9-]+:before/);
        let out = css.slice(0, firstIcon);
        let glyphs = '';
        for (const m of css.matchAll(/\.ph\.(ph-[a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-f]+)";\s*\}/gi)) {
          if (!used.has(m[1])) continue;
          out += `.ph.${m[1]}:before{content:"\\${m[2]}"}\n`;
          glyphs += String.fromCodePoint(parseInt(m[2], 16));
        }
        const font = await subsetFont(await readFile(fontPath), glyphs, { targetFormat: 'woff2' });
        await writeFile(cssPath, out);
        await writeFile(fontPath, font);

        // the subset stylesheet is tiny: inline it so it costs no blocking request
        const link = '<link rel="stylesheet" href="/vendor/phosphor/phosphor.css">';
        const inline = `<style>${out.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')}</style>`;
        const inlineInto = async (folder) => {
          for (const entry of await readdir(folder, { withFileTypes: true })) {
            const full = path.join(folder, entry.name);
            if (entry.isDirectory()) await inlineInto(full);
            else if (entry.name.endsWith('.html')) {
              const html = await readFile(full, 'utf8');
              if (html.includes(link)) await writeFile(full, html.replace(link, inline));
            }
          }
        };
        await inlineInto(dist);
        logger.info(`kept ${glyphs.length} icons, font ${Math.round(font.length / 102.4) / 10} KB`);
      },
    },
  };
}
