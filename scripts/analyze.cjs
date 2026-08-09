// Quick Ogg Opus analyzer — run with: node scripts/analyze.cjs <file.opus>
const fs = require('fs')

const file = process.argv[2]
if (!file) {
  console.error('Usage: node analyze.cjs <file.opus>')
  process.exit(1)
}

const data = fs.readFileSync(file)
console.log(`File: ${file}`)
console.log(`Size: ${(data.length / 1024 / 1024).toFixed(2)} MB`)

// Find all Ogg pages
const pages = []
let offset = 0
while (offset < data.length - 27) {
  const magic = data.toString('ascii', offset, offset + 4)
  if (magic !== 'OggS') { offset++; continue }

  const headerType = data[offset + 5]
  const granulePos = data.readBigInt64LE(offset + 6)
  // segment count
  const segmentCount = data[offset + 26]
  const segmentTable = data.slice(offset + 27, offset + 27 + segmentCount)
  const payloadSize = segmentTable.reduce((a, b) => a + b, 0)
  const pageEnd = offset + 27 + segmentCount + payloadSize

  pages.push({
    start: offset,
    end: pageEnd,
    headerType,
    granulePos: Number(granulePos),
    segmentCount,
    payloadSize
  })

  offset = pageEnd
}

console.log(`Pages found: ${pages.length}`)
console.log(`Sample rate assumed: 48000 Hz`)
if (pages.length > 0) {
  const lastGranule = pages[pages.length - 1].granulePos
  const duration = lastGranule / 48000
  console.log(`Duration: ${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')} (${duration.toFixed(1)}s)`)
}

// Parse OpusHead from first page's data
if (pages.length > 0) {
  const firstPage = pages[0]
  const segCount = firstPage.segmentCount
  const segTable = data.slice(firstPage.start + 27, firstPage.start + 27 + segCount)
  const payload = data.slice(firstPage.start + 27 + segCount, firstPage.start + 27 + segCount + firstPage.payloadSize)

  // OpusHead: "OpusHead" + version + channel_count + pre_skip + input_sample_rate + output_gain + mapping_family
  const headStr = payload.toString('ascii', 0, 8)
  if (headStr === 'OpusHead') {
    const version = payload[8]
    const channelCount = payload[9]
    const preSkip = payload.readUInt16LE(10)
    const inputSampleRate = payload.readUInt32LE(12)
    const outputGain = payload.readInt16LE(16)
    const mappingFamily = payload[18]

    console.log('\n--- OpusHead ---')
    console.log(`Version: ${version}`)
    console.log(`Channels: ${channelCount}`)
    console.log(`Pre-skip: ${preSkip}`)
    console.log(`Input sample rate: ${inputSampleRate}`)
    console.log(`Output gain: ${outputGain}`)
    console.log(`Mapping family: ${mappingFamily}`)

    if (mappingFamily === 1 || mappingFamily === 255) {
      let pos = 19
      const streamCount = payload[pos++]
      const coupledCount = payload[pos++]
      const channelMapping = Array.from(payload.slice(pos, pos + channelCount))
      pos += channelCount

      console.log(`Streams: ${streamCount}, Coupled: ${coupledCount}`)
      console.log(`Channel mapping: ${channelMapping.join(', ')}`)

      const monoCount = channelCount - (coupledCount * 2)
      const stereoPairs = coupledCount
      console.log(`\nInterpretation:`)
      console.log(`  Mono tracks: ${monoCount} (channels 0..${monoCount - 1})`)
      let idx = monoCount
      for (let i = 0; i < coupledCount; i++) {
        console.log(`  Stereo track ${i + 1}: channels L=${channelMapping[idx]} R=${channelMapping[idx + 1]}`)
        idx += 2
      }
    }
  }

  // Check for OpusTags (comments) in second page
  if (pages.length > 1) {
    const p2Start = pages[1].start
    const segCount2 = data[p2Start + 26]
    const payload2 = data.slice(p2Start + 27 + segCount2, p2Start + 27 + segCount2 + pages[1].payloadSize)
    if (payload2.toString('ascii', 0, 8) === 'OpusTags') {
      const vendorLen = payload2.readUInt32LE(8)
      const vendor = payload2.toString('utf8', 12, 12 + vendorLen)
      console.log(`\nVendor: ${vendor}`)
    }
  }
}

// Show first and last few pages
console.log('\n--- First 5 pages ---')
for (let i = 0; i < Math.min(5, pages.length); i++) {
  const p = pages[i]
  const flags = []
  if (p.headerType & 1) flags.push('CONT')
  if (p.headerType & 2) flags.push('BOS')
  if (p.headerType & 4) flags.push('EOS')
  console.log(`  Page ${i}: offset=${p.start}, size=${p.end - p.start}, granule=${p.granulePos}, flags=${flags.join(',') || 'none'}`)
}

if (pages.length > 5) {
  console.log(`  ... (${pages.length - 10} pages omitted) ...`)
  for (let i = Math.max(5, pages.length - 5); i < pages.length; i++) {
    const p = pages[i]
    console.log(`  Page ${i}: offset=${p.start}, size=${p.end - p.start}, granule=${p.granulePos}`)
  }
}
