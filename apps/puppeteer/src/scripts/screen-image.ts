/**
 * Screens one picture with the real engines, without writing anything.
 *
 * Usage: `nub run screen:image <arquivo> --kind banner|logo [--crop] [--ignore-size] [--policy 30,80] [--raw]`
 *
 * Runs the same code an upload runs: `prepareImage` (proportion, minimum size, WebP
 * normalization, thumbhash), then Sightengine and OpenAI omni-moderation, combined as in
 * production (the most severe score wins). It prints each engine's scores, the combined
 * ones and, with `--policy`, the verdict that Screening Policy would give.
 * Nothing is stored: no database, no Cloudinary, no Image.
 *
 * - `--kind`: the Image's kind, which sets its proportion and sizes (16:9 banner, 1:1 logo).
 * - `--crop`: does what the app's cropper does in the browser before upload: takes the
 *   largest centred area of that proportion, scales it down to the kind's maximum when
 *   larger and encodes it as a JPEG at quality 90. Without it the file is screened as is,
 *   so it must already be in proportion and within the 4 MB upload limit.
 * - `--ignore-size`: skips the upload checks (proportion, minimum size, 4 MB) to screen any
 *   picture. With `--crop` the picture is cropped as above; without it the whole picture is
 *   kept, only scaled down to fit inside the kind's maximum (never cropped, stretched or
 *   enlarged), so nothing is cut off. Then it is normalized like an upload. The app still
 *   refuses such pictures; engines judge very small ones less reliably.
 * - `--policy lower,upper`: cut-offs in percent applied to every category.
 * - `--raw`: also prints each engine's JSON answer, to check the category mapping.
 *
 * Reads SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET and OPENAI_API_KEY from `.env`.
 * Each picture spends about 4 Sightengine operations (free plan: 500 a day); `--raw` shows
 * the exact count in the answer's `request.operations`.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { z } from 'zod';
import { prepareImage, normalizeImage, IMAGE_RULES } from '../images/prepare.ts';
import { verdictFor } from '../images/verdict.ts';
import { CombinedImageScreener } from '../io/screening/combined.ts';
import { SightengineImageScreener } from '../io/screening/sightengine.ts';
import { OpenAIImageScreener } from '../io/screening/openai.ts';
import type { ImageScreener, ScreeningFailure } from '../io/index.ts';
import { SCREENING_CATEGORIES, type ImageKind, type ScreeningPolicy, type ScreeningScores } from '../types/image.ts';
import { err, ok, type Result } from '../utils/result.ts';

/** What the command line asked for. */
interface Options {
  file: string;
  kind: ImageKind;
  crop: boolean;
  ignoreSize: boolean;
  policy: ScreeningPolicy | null;
  raw: boolean;
}

const USAGE = 'Uso: nub run screen:image <arquivo> --kind banner|logo [--crop] [--ignore-size] [--policy 30,80] [--raw]';

/** Reads and checks the command line. */
function parseOptions(argv: string[]): Result<Options, string> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        kind: { type: 'string' },
        crop: { type: 'boolean' },
        'ignore-size': { type: 'boolean' },
        policy: { type: 'string' },
        raw: { type: 'boolean' }
      }
    });
  } catch (error) {
    return err(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
  }
  const { positionals, values } = parsed;
  if (positionals.length !== 1 || positionals[0] === undefined) return err(`Informe exatamente um arquivo.\n${USAGE}`);

  const kinds: Record<string, ImageKind> = { banner: 'event_banner', logo: 'organization_logo' };
  const kind = values.kind === undefined ? undefined : kinds[values.kind];
  if (kind === undefined) return err(`Informe --kind banner ou --kind logo.\n${USAGE}`);

  let policy: ScreeningPolicy | null = null;
  if (values.policy !== undefined) {
    const match = /^(\d{1,3}),(\d{1,3})$/.exec(values.policy);
    const lower = match ? Number(match[1]) : NaN;
    const upper = match ? Number(match[2]) : NaN;
    if (!(lower >= 0 && lower <= upper && upper <= 100)) return err(`--policy deve ser "revisão,recusa" em porcentagem, ex.: 30,80.\n${USAGE}`);
    policy = Object.fromEntries(SCREENING_CATEGORIES.map(category => [category, { lower: lower / 100, upper: upper / 100 }])) as ScreeningPolicy;
  }

  return ok({ file: positionals[0], kind, crop: values.crop === true, ignoreSize: values['ignore-size'] === true, policy, raw: values.raw === true });
}

/**
 * What the app's cropper sends: the largest centred area of the kind's proportion (after
 * the EXIF orientation), scaled down to the kind's maximum when larger, as a JPEG at
 * quality 90.
 */
async function cropLikeTheApp(bytes: Uint8Array, kind: ImageKind): Promise<Result<Uint8Array, string>> {
  try {
    const { proportion: [across, down], maximum } = IMAGE_RULES[kind];
    const oriented = await sharp(bytes).autoOrient().toBuffer({ resolveWithObject: true });
    const width = Math.min(oriented.info.width, Math.floor((oriented.info.height * across) / down));
    const height = Math.round((width * down) / across);
    const left = Math.floor((oriented.info.width - width) / 2);
    const top = Math.floor((oriented.info.height - height) / 2);
    const outputWidth = Math.min(width, maximum.width);
    const cropped = await sharp(oriented.data)
      .extract({ left, top, width, height })
      .resize(outputWidth, Math.round((outputWidth * down) / across), { fit: 'fill' })
      .jpeg({ quality: 90 })
      .toBuffer();
    return ok(new Uint8Array(cropped));
  } catch (error) {
    return err(`Não foi possível recortar a imagem: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * The whole picture (EXIF orientation applied), scaled down to fit inside the kind's maximum
 * keeping its proportion, as a JPEG at quality 90. Never cropped, stretched or enlarged.
 */
async function fitWithinMaximum(bytes: Uint8Array, kind: ImageKind): Promise<Result<Uint8Array, string>> {
  const { maximum } = IMAGE_RULES[kind];
  try {
    const fitted = await sharp(bytes)
      .autoOrient()
      .resize(maximum.width, maximum.height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    return ok(new Uint8Array(fitted));
  } catch (error) {
    return err(`Não foi possível reduzir a imagem: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Says how big the picture that reached `prepareImage` is, against the kind's minimum. */
async function sizeNote(bytes: Uint8Array, kind: ImageKind, cropped: boolean): Promise<string> {
  const { minimum } = IMAGE_RULES[kind];
  const name = kind === 'event_banner' ? 'banner' : 'logo';
  try {
    const metadata = await sharp(bytes).autoOrient().metadata();
    const what = cropped ? 'O recorte centralizado' : 'A imagem';
    return ` ${what} tem ${metadata.width}×${metadata.height}; o mínimo para ${name} é ${minimum.width}×${minimum.height}.`;
  } catch (error) {
    return ` (não foi possível ler o tamanho: ${error instanceof Error ? error.message : String(error)})`;
  }
}

/** A fetch that prints each JSON answer under `label` before handing it on. */
function printingFetch(label: string): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    console.log(`\n--- Resposta bruta: ${label} (HTTP ${response.status}) ---`);
    console.log(await response.clone().text());
    return response;
  };
}

/** An engine answer already obtained, so combining it costs no second call. */
class AnsweredScreener implements ImageScreener {
  constructor(private answer: Result<ScreeningScores, ScreeningFailure>) {}

  async screen(): Promise<Result<ScreeningScores, ScreeningFailure>> {
    return this.answer;
  }
}

/** The scores as aligned percentages, one category per line; categories not measured say so. */
function formatScores(scores: ScreeningScores): string {
  return SCREENING_CATEGORIES.map(category => {
    const score = scores[category];
    return `  ${category.padEnd(18)} ${score === undefined ? 'não medido' : `${(score * 100).toFixed(1)}%`}`;
  }).join('\n');
}

/** Prints an engine's outcome under its name. */
function printOutcome(name: string, outcome: Result<ScreeningScores, ScreeningFailure>): void {
  console.log(`\n${name}:`);
  if (outcome.ok) {
    console.log(formatScores(outcome.value));
    return;
  }
  console.log(`  ❌ falhou: ${outcome.error.reason}`);
  if (Object.keys(outcome.error.partialScores).length > 0) console.log(formatScores(outcome.error.partialScores));
}

/** The whole run; an error is the message to print. */
async function run(argv: string[]): Promise<Result<void, string>> {
  const options = parseOptions(argv);
  if (!options.ok) return options;
  const { file, kind, crop, ignoreSize, policy, raw } = options.value;

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(file));
  } catch (error) {
    return err(`Não foi possível ler ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (crop) {
    const cropped = await cropLikeTheApp(bytes, kind);
    if (!cropped.ok) return cropped;
    bytes = cropped.value;
  } else if (ignoreSize) {
    const fitted = await fitWithinMaximum(bytes, kind);
    if (!fitted.ok) return fitted;
    bytes = fitted.value;
  }

  const prepared = ignoreSize ? await normalizeImage(bytes, kind) : await prepareImage(bytes, kind);
  if (!prepared.ok) {
    const fixable = prepared.error === 'wrong_proportion' || prepared.error === 'too_large';
    const hint = fixable && !crop ? ' Use --crop para recortar como o app faz, ou --ignore-size para analisar a imagem inteira.'
      : prepared.error === 'too_small' ? ' Use --ignore-size para analisar mesmo assim (o app recusaria).' : '';
    return err(`O upload seria recusado: ${prepared.error}.${hint}${prepared.error === 'too_small' ? await sizeNote(bytes, kind, crop) : ''}`);
  }
  const { webp, width, height, thumbhash } = prepared.value;
  console.log(`Imagem normalizada: ${width}×${height} WebP, ${(webp.byteLength / 1024).toFixed(1)} KB, thumbhash ${thumbhash}`);

  const env = z.object({
    SIGHTENGINE_API_USER: z.string().min(1),
    SIGHTENGINE_API_SECRET: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1)
  }).safeParse(process.env);
  if (!env.success) return err(`Defina no .env: ${Object.keys(env.error.flatten().fieldErrors).join(', ')}`);

  const sightengine = new SightengineImageScreener(env.data.SIGHTENGINE_API_USER, env.data.SIGHTENGINE_API_SECRET, raw ? printingFetch('Sightengine') : fetch);
  const openai = new OpenAIImageScreener(env.data.OPENAI_API_KEY, raw ? printingFetch('OpenAI') : fetch);
  const [fromSightengine, fromOpenAI] = await Promise.all([sightengine.screen(webp), openai.screen(webp)]);
  printOutcome('Sightengine', fromSightengine);
  printOutcome('OpenAI omni-moderation', fromOpenAI);

  const combined = await new CombinedImageScreener([new AnsweredScreener(fromSightengine), new AnsweredScreener(fromOpenAI)]).screen(webp);
  printOutcome('Combinado (o mais severo vence)', combined);

  if (policy === null) {
    console.log('\nSem --policy: nenhum veredito calculado.');
  } else if (!combined.ok) {
    console.log('\nVeredito: in_review (não analisada: um motor falhou)');
  } else {
    console.log(`\nVeredito: ${verdictFor(combined.value, policy)}`);
  }
  return ok(undefined);
}

const outcome = await run(process.argv.slice(2));
if (!outcome.ok) {
  console.error(`❌ ${outcome.error}`);
  process.exitCode = 1;
}
