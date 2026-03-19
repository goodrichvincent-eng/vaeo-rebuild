import sharp from 'sharp'
import { readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

const dir = './public/images'
const files = readdirSync(dir)

for (const file of files) {
  const ext = extname(file).toLowerCase()
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue

  const input = join(dir, file)
  const stat = statSync(input)

  // Only convert files over 50KB
  if (stat.size < 50000) continue

  const outName = basename(file, ext) + '.webp'
  const output = join(dir, outName)

  await sharp(input)
    .webp({ quality: 82 })
    .toFile(output)

  console.log(`✓ ${file} (${Math.round(stat.size / 1024)}KB) → ${outName}`)
}
